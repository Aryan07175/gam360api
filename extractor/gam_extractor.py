"""
gam_extractor.py
================
Pulls revenue data from Google Ad Manager 360 using the SOAP API
(ReportService). Matches exactly what you see in the GAM 360 dashboard.

Flow:
  1. Build a ReportQuery with AD_UNIT_NAME dimension + revenue columns
  2. Call runReportJob  → get job ID
  3. Poll getReportJobStatus until COMPLETED
  4. Download CSV from getReportDownloadUrlWithOptions
  5. Parse CSV → list of dicts → save to DB

Usage:
  python extractor/gam_extractor.py --date yesterday
  python extractor/gam_extractor.py --date 2025-06-01
  python extractor/gam_extractor.py --start 2025-06-01 --end 2025-06-07
"""

import os
import sys
import io
import gzip
import time
import argparse
import logging
from datetime import date, timedelta, datetime
from pathlib import Path
from typing import Optional

import yaml
import pandas as pd
from dotenv import load_dotenv
from googleads import ad_manager, errors

# ── project root on path ──────────────────────────────────────────────────────
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from database.db import RevenueDB

load_dotenv(Path(__file__).resolve().parent.parent / "config" / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("gam_extractor")

# ── constants — match exactly what the GAM 360 dashboard shows ────────────────
API_VERSION = os.getenv("GAM_API_VERSION", "v202602")

# Dimensions: these break the report down per app (ad unit) and by date
DIMENSIONS = [
    "DATE",           # one row per day
    "AD_UNIT_NAME",   # the app / ad unit name (matches GAM UI "Ad unit" column)
    "AD_UNIT_ID",     # numeric ID for the ad unit
]

# Optional extra dimensions you can enable
EXTRA_DIMENSIONS = [
    # "ORDER_NAME",         # which order served the ad
    # "LINE_ITEM_NAME",     # which line item
    # "AD_REQUEST_AD_TYPE", # banner / interstitial / rewarded / native
    # "COUNTRY_NAME",       # revenue by country per app
    # "DEVICE_CATEGORY_NAME",
]

# Columns: these are the revenue + performance metrics
# They match the GAM 360 dashboard "Total revenue", "Impressions", "eCPM" etc.
COLUMNS = [
    "AD_SERVER_IMPRESSIONS",             # Impressions (matches dashboard)
    "AD_SERVER_CLICKS",                  # Clicks
    "AD_SERVER_CTR",                     # CTR %
    "AD_SERVER_AD_REQUESTS",             # Total ad requests
    "AD_SERVER_FILL_RATE",               # Fill rate %
    "AD_SERVER_CPM_AND_CPC_REVENUE",     # Total revenue (CPM + CPC)
    "AD_SERVER_WITHOUT_CPD_AVERAGE_ECPM",# eCPM (effective CPM)
    # Programmatic / AdX revenue (uncomment if you have AdX enabled):
    # "AD_EXCHANGE_LINE_ITEM_LEVEL_REVENUE",
    # "TOTAL_LINE_ITEM_LEVEL_CPM_AND_CPC_REVENUE",
]


class GAMRevenueExtractor:
    """
    Extracts revenue data from GAM 360 via the SOAP ReportService.
    Results match the GAM 360 UI dashboard reports exactly.
    """

    def __init__(self, credentials_path: str = None, network_code: str = None):
        creds = credentials_path or os.getenv(
            "GAM_CREDENTIALS_PATH", "config/googleads.yaml"
        )
        self.client = ad_manager.AdManagerClient.LoadFromStorage(creds)

        # Override network code from env if not in yaml
        nc = network_code or os.getenv("GAM_NETWORK_CODE")
        if nc:
            self.client.network_code = str(nc)

        self.network_code = self.client.network_code
        log.info("GAM client initialised - network code: %s", self.network_code)

    def _report_service(self):
        return self.client.GetService("ReportService", version=API_VERSION)

    # ── date helpers ──────────────────────────────────────────────────────────

    @staticmethod
    def _to_gam_date(d: date) -> dict:
        """Convert Python date to GAM API date dict."""
        return {"year": d.year, "month": d.month, "day": d.day}

    @staticmethod
    def _resolve_date(s: str) -> date:
        if s == "yesterday":
            return date.today() - timedelta(days=1)
        if s == "today":
            return date.today()
        return datetime.strptime(s, "%Y-%m-%d").date()

    # ── core API calls ────────────────────────────────────────────────────────

    def run_report(
        self,
        start: date,
        end: date,
        extra_dimensions: list[str] = None,
        filter_ad_unit_id: Optional[str] = None,
    ) -> int:
        """
        Submit a report job to GAM and return its job ID.
        The report uses the same dimensions & columns visible in the GAM UI.
        """
        report_service = self._report_service()

        dimensions = DIMENSIONS + (extra_dimensions or [])

        report_query = {
            "dimensions": dimensions,
            "columns": COLUMNS,
            "dateRangeType": "CUSTOM_DATE",
            "startDate": self._to_gam_date(start),
            "endDate": self._to_gam_date(end),
        }

        # Optional: filter to a specific ad unit (app) by its ID
        if filter_ad_unit_id:
            report_query["statement"] = {
                "query": "WHERE AD_UNIT_ID = :adUnitId",
                "values": [
                    {
                        "key": "adUnitId",
                        "value": {
                            "xsi_type": "NumberValue",
                            "value": str(filter_ad_unit_id),
                        },
                    }
                ],
            }

        report_job = {"reportQuery": report_query}

        try:
            report_job = report_service.runReportJob(report_job)
        except Exception as e:
            log.error("Failed to run report job: %s", e)
            raise

        job_id = report_job["id"]
        log.info("Report job submitted - ID: %s", job_id)
        return job_id

    def wait_for_report(self, job_id: int, poll_interval: int = 10) -> bool:
        """
        Poll until the report job completes or fails.
        Returns True on success.
        """
        report_service = self._report_service()
        log.info("Polling report job %s …", job_id)

        while True:
            status = report_service.getReportJobStatus(job_id)
            log.info("  status: %s", status)

            if status == "COMPLETED":
                log.info("Report job %s completed.", job_id)
                return True
            elif status == "FAILED":
                log.error("Report job %s failed.", job_id)
                return False

            time.sleep(poll_interval)

    def download_report(self, job_id: int) -> pd.DataFrame:
        """
        Download the completed report CSV and return as a DataFrame.
        Revenue values come in micros (1/1,000,000 of currency unit).
        We convert them to dollars automatically.
        """
        report_service = self._report_service()

        # Request gzipped CSV — matches exactly what you'd export from the UI
        report_url = report_service.getReportDownloadUrlWithOptions(
            job_id,
            {
                "exportFormat": "CSV_DUMP",  # raw CSV with all columns
                "useGzipCompression": True,
            },
        )

        log.info("Downloading report from URL …")

        # DataDownloader handles auth + redirect automatically
        downloader = self.client.GetDataDownloader(version=API_VERSION)

        try:
            raw = downloader.DownloadReportAsString(
                job_id,
                export_format="CSV_DUMP",
                use_gzip_compression=True,
            )
        except Exception:
            # Fallback: download via URL directly
            import urllib.request
            with urllib.request.urlopen(report_url) as resp:
                raw = resp.read()
            if report_url.endswith("gz") or raw[:2] == b"\x1f\x8b":
                raw = gzip.decompress(raw)
            raw = raw.decode("utf-8")

        df = pd.read_csv(io.StringIO(raw))
        log.info("Downloaded %d rows.", len(df))

        # Normalise column names to snake_case
        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

        df = self._convert_revenue_columns(df)
        return df

    # ── revenue conversion ────────────────────────────────────────────────────

    @staticmethod
    def _convert_revenue_columns(df: pd.DataFrame) -> pd.DataFrame:
        """
        GAM SOAP API returns revenue in MICROS (1/1,000,000 of the currency).
        e.g. $1.00 = 1,000,000 micros
        This converts them to actual dollar values.
        """
        revenue_cols = [
            c for c in df.columns
            if "revenue" in c or "ecpm" in c or "cpm" in c
        ]
        use_micros = os.getenv("REVENUE_IN_MICROS", "false").lower() == "true"

        if not use_micros:
            for col in revenue_cols:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors="coerce") / 1_000_000

        # Round to 6 decimal places for precision
        for col in revenue_cols:
            if col in df.columns:
                df[col] = df[col].round(6)

        return df

    # ── main extraction method ────────────────────────────────────────────────

    def extract_revenue(
        self,
        start: date,
        end: date,
        save_to_db: bool = True,
        save_csv: bool = True,
        filter_ad_unit_id: Optional[str] = None,
    ) -> pd.DataFrame:
        """
        Full extraction: run report → wait → download → save.
        Returns the revenue DataFrame.
        """
        log.info("Extracting revenue: %s to %s", start, end)

        job_id = self.run_report(start, end, filter_ad_unit_id=filter_ad_unit_id)

        if not self.wait_for_report(job_id):
            raise RuntimeError(f"Report job {job_id} failed.")

        df = self.download_report(job_id)

        if save_csv:
            out_dir = Path(os.getenv("REPORTS_OUTPUT_DIR", "reports/output"))
            out_dir.mkdir(parents=True, exist_ok=True)
            csv_path = out_dir / f"revenue_{start}_{end}.csv"
            df.to_csv(csv_path, index=False)
            log.info("CSV saved: %s", csv_path)

        if save_to_db:
            db = RevenueDB()
            db.upsert_revenue_rows(df, network_code=self.network_code)
            db.close()
            log.info("Saved to database.")

        return df

    def extract_per_app_summary(self, target_date: date) -> pd.DataFrame:
        """
        Convenience method: extract revenue grouped by app (ad unit)
        for a single day. Matches the GAM 360 dashboard 'Apps' view.
        """
        df = self.extract_revenue(target_date, target_date)

        # Group by app / ad unit
        group_cols = ["ad_unit_name", "ad_unit_id"]
        agg = {
            "ad_server_impressions": "sum",
            "ad_server_clicks": "sum",
            "ad_server_ad_requests": "sum",
            "ad_server_cpn_and_cpc_revenue": "sum",  # total revenue
        }

        # Keep only columns that actually exist in the download
        existing_agg = {k: v for k, v in agg.items() if k in df.columns}
        existing_group = [c for c in group_cols if c in df.columns]

        if not existing_group:
            log.warning("No ad unit columns found in report output.")
            return df

        summary = df.groupby(existing_group, as_index=False).agg(existing_agg)
        summary = summary.sort_values(
            by=list(existing_agg.keys())[-1], ascending=False
        )

        return summary


# ── CLI entry point ────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Extract GAM 360 revenue data via SOAP API"
    )
    parser.add_argument(
        "--date",
        default="yesterday",
        help="Single date: 'yesterday', 'today', or YYYY-MM-DD",
    )
    parser.add_argument("--start", help="Start date YYYY-MM-DD (overrides --date)")
    parser.add_argument("--end", help="End date YYYY-MM-DD (overrides --date)")
    parser.add_argument("--ad-unit-id", help="Filter to a single ad unit (app) ID")
    parser.add_argument("--no-db", action="store_true", help="Skip saving to database")
    parser.add_argument("--no-csv", action="store_true", help="Skip saving CSV")
    parser.add_argument("--network-code", help="Override network code from config")
    args = parser.parse_args()

    extractor = GAMRevenueExtractor(network_code=args.network_code)

    if args.start and args.end:
        start = GAMRevenueExtractor._resolve_date(args.start)
        end = GAMRevenueExtractor._resolve_date(args.end)
    else:
        start = end = GAMRevenueExtractor._resolve_date(args.date)

    df = extractor.extract_revenue(
        start=start,
        end=end,
        save_to_db=not args.no_db,
        save_csv=not args.no_csv,
        filter_ad_unit_id=args.ad_unit_id,
    )

    print("\n── Revenue by App ──────────────────────────────────────")
    print(df.to_string(index=False))
    print(f"\nTotal rows: {len(df)}")


if __name__ == "__main__":
    main()
