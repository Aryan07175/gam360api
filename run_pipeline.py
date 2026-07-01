"""
run_pipeline.py
===============
Daily automation script. Run this via cron at 6 AM to:
  1. Extract yesterday's revenue from GAM 360 SOAP API
  2. Save to database
  3. Call Claude via MCP to generate summary + detect anomalies
  4. Save report to file
  5. Send Slack alert if anomalies found

Cron entry (runs at 06:00 every day):
  0 6 * * * cd /path/to/gam360-pipeline && python run_pipeline.py >> logs/pipeline.log 2>&1

Usage:
  python run_pipeline.py                          # yesterday
  python run_pipeline.py --date 2025-06-01        # specific date
  python run_pipeline.py --date 2025-06-01 --slack  # with Slack alert
"""

import os
import sys
import json
import logging
import argparse
import requests
from datetime import date, timedelta, datetime
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / "config" / ".env")
sys.path.insert(0, str(Path(__file__).resolve().parent))

from extractor.gam_extractor import GAMRevenueExtractor
from database.db import RevenueDB

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("pipeline")

SLACK_WEBHOOK    = os.getenv("SLACK_WEBHOOK_URL", "")
ANOMALY_THRESH   = float(os.getenv("ANOMALY_THRESHOLD_PCT", "20"))
REPORTS_DIR      = Path(os.getenv("REPORTS_OUTPUT_DIR", "reports/output"))
NETWORK_CODE     = os.getenv("GAM_NETWORK_CODE", "")


def run_pipeline(target_date: date, send_slack: bool = False):
    log.info("=== Pipeline start -- date: %s ===", target_date)

    # ── Step 1: Extract from GAM 360 SOAP API ─────────────────────────────────
    log.info("[1/4] Extracting revenue from GAM 360 SOAP API ...")
    extractor = GAMRevenueExtractor()
    df = extractor.extract_revenue(
        start=target_date,
        end=target_date,
        save_to_db=True,
        save_csv=True,
    )
    log.info("      Extracted %d rows.", len(df))

    # ── Step 2: Query DB for summary ──────────────────────────────────────────
    log.info("[2/4] Building summary from database ...")
    db = RevenueDB()
    rows      = db.get_revenue_by_app(str(target_date), limit=100)
    totals    = db.get_network_daily_total(str(target_date))
    anomalies = db.get_anomalies(str(target_date), threshold_pct=ANOMALY_THRESH)

    total_rev = totals.get("total_revenue_usd") or 0
    top_app   = totals.get("top_app_name") or "N/A"
    app_count = totals.get("app_count") or len(rows)

    log.info(
        "      Total revenue: $%.4f | Apps: %d | Anomalies: %d",
        total_rev, app_count, len(anomalies),
    )

    # ── Step 3: Generate report file ──────────────────────────────────────────
    log.info("[3/4] Writing report file ...")
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    lines = [
        f"# GAM 360 Revenue Report — {target_date}",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"Network: {NETWORK_CODE}",
        "",
        "## Summary",
        f"- Total revenue: ${total_rev:,.4f}",
        f"- Total impressions: {int(totals.get('total_impressions') or 0):,}",
        f"- App count: {app_count}",
        f"- Top app: {top_app}",
        f"- Avg eCPM: ${totals.get('avg_ecpm') or 0:,.3f}",
        f"- Avg fill rate: {totals.get('avg_fill_rate') or 0:.1f}%",
        "",
        "## Revenue by App (top 20)",
        "",
        "| Rank | App | Revenue (USD) | Impressions | eCPM | Fill % |",
        "|------|-----|--------------|-------------|------|--------|",
    ]

    for i, r in enumerate(rows[:20], 1):
        name = (r.get("ad_unit_name") or "Unknown")[:35]
        lines.append(
            f"| {i} | {name} "
            f"| ${r.get('revenue_usd') or 0:,.4f} "
            f"| {int(r.get('impressions') or 0):,} "
            f"| ${r.get('ecpm_usd') or 0:,.3f} "
            f"| {r.get('fill_rate_pct') or 0:.1f}% |"
        )

    if anomalies:
        lines += [
            "",
            f"## ⚠️ Anomalies — Revenue Drop > {ANOMALY_THRESH}%",
            "",
            "| App | Today | 7-day avg | Drop % |",
            "|-----|-------|-----------|--------|",
        ]
        for a in anomalies:
            lines.append(
                f"| {a.get('ad_unit_name','?')} "
                f"| ${a.get('today_revenue',0):,.4f} "
                f"| ${a.get('avg_revenue_7d',0):,.4f} "
                f"| {a.get('drop_pct',0):.1f}% |"
            )
    else:
        lines += ["", "✅ No revenue anomalies detected."]

    report_text = "\n".join(lines)
    report_path = REPORTS_DIR / f"revenue_report_{target_date}.md"
    report_path.write_text(report_text, encoding="utf-8")
    log.info("      Report saved: %s", report_path)

    # ── Step 4: Save summary to DB ────────────────────────────────────────────
    db.save_summary({
        "network_code":     NETWORK_CODE,
        "report_date":      str(target_date),
        "total_revenue":    total_rev,
        "total_impressions": totals.get("total_impressions"),
        "total_clicks":     totals.get("total_clicks"),
        "app_count":        app_count,
        "top_app_name":     top_app,
        "top_app_revenue":  totals.get("top_app_revenue"),
        "summary_text":     report_text[:4000],
        "anomalies":        json.dumps(anomalies),
    })
    db.close()

    # ── Step 5: Slack alert ───────────────────────────────────────────────────
    if send_slack and SLACK_WEBHOOK:
        _send_slack(target_date, total_rev, app_count, anomalies)

    log.info("=== Pipeline complete ===")
    return report_path


def _send_slack(target_date, total_rev, app_count, anomalies):
    emoji = "🚨" if anomalies else "✅"
    anom_text = ""
    if anomalies:
        lines = [f"• *{a['ad_unit_name']}*: {a['drop_pct']:.0f}% drop" for a in anomalies[:5]]
        anom_text = "\n*Anomalies:*\n" + "\n".join(lines)

    message = {
        "text": (
            f"{emoji} *GAM 360 Revenue Report — {target_date}*\n"
            f"Total revenue: *${total_rev:,.2f}*\n"
            f"Apps reporting: {app_count}"
            f"{anom_text}"
        )
    }
    try:
        r = requests.post(SLACK_WEBHOOK, json=message, timeout=10)
        log.info("Slack notification sent: %s", r.status_code)
    except Exception as e:
        log.warning("Slack notification failed: %s", e)


# ── CLI ────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Run GAM 360 revenue pipeline")
    parser.add_argument(
        "--date",
        default="yesterday",
        help="Date to process: 'yesterday', 'today', or YYYY-MM-DD",
    )
    parser.add_argument("--slack", action="store_true", help="Send Slack notification")
    args = parser.parse_args()

    if args.date == "yesterday":
        target = date.today() - timedelta(days=1)
    elif args.date == "today":
        target = date.today()
    else:
        target = datetime.strptime(args.date, "%Y-%m-%d").date()

    report_path = run_pipeline(target, send_slack=args.slack)
    print(f"\n[OK] Done. Report: {report_path}")


if __name__ == "__main__":
    main()
