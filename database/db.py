"""
db.py
=====
Database layer for GAM 360 revenue data.
Supports PostgreSQL (production) and SQLite (development / local).

Usage:
  python database/db.py --init       # create tables
  python database/db.py --summary    # print revenue summary
"""

import os
import sys
import json
import logging
import argparse
from datetime import date, datetime
from pathlib import Path
from typing import Optional

import pandas as pd
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / "config" / ".env")

log = logging.getLogger("gam_db")

# ── choose backend ─────────────────────────────────────────────────────────────

DATABASE_URL = os.getenv("DATABASE_URL", "")
SQLITE_PATH  = os.getenv("SQLITE_PATH", "database/gam_revenue.db")

USE_POSTGRES = bool(DATABASE_URL)

if USE_POSTGRES:
    import psycopg2
    import psycopg2.extras
else:
    import sqlite3


# ── SQL for both backends ──────────────────────────────────────────────────────

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS gam_revenue (
    id                  SERIAL PRIMARY KEY,   -- INTEGER PRIMARY KEY in SQLite
    network_code        TEXT        NOT NULL,
    report_date         DATE        NOT NULL,
    ad_unit_id          TEXT,
    ad_unit_name        TEXT,
    impressions         BIGINT      DEFAULT 0,
    clicks              BIGINT      DEFAULT 0,
    ad_requests         BIGINT      DEFAULT 0,
    fill_rate_pct       NUMERIC(8,4),
    ctr_pct             NUMERIC(8,4),
    revenue_usd         NUMERIC(14,6),
    ecpm_usd            NUMERIC(10,6),
    raw_row             JSONB,               -- TEXT in SQLite
    created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (network_code, report_date, ad_unit_id)
);

CREATE TABLE IF NOT EXISTS gam_revenue_summaries (
    id              SERIAL PRIMARY KEY,
    network_code    TEXT       NOT NULL,
    report_date     DATE       NOT NULL UNIQUE,
    total_revenue   NUMERIC(14,6),
    total_impressions BIGINT,
    total_clicks    BIGINT,
    app_count       INTEGER,
    top_app_name    TEXT,
    top_app_revenue NUMERIC(14,6),
    summary_text    TEXT,       -- Claude-generated AI summary
    anomalies       TEXT,       -- JSON list of flagged apps
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
"""

# SQLite doesn't support SERIAL, JSONB, TIMESTAMPTZ
SCHEMA_SQL_SQLITE = SCHEMA_SQL \
    .replace("SERIAL PRIMARY KEY", "INTEGER PRIMARY KEY AUTOINCREMENT") \
    .replace("JSONB", "TEXT") \
    .replace("TIMESTAMPTZ", "TIMESTAMP") \
    .replace("BIGINT", "INTEGER")


class RevenueDB:
    def __init__(self):
        if USE_POSTGRES:
            self.conn = psycopg2.connect(DATABASE_URL)
            self.backend = "postgres"
        else:
            Path(SQLITE_PATH).parent.mkdir(parents=True, exist_ok=True)
            self.conn = sqlite3.connect(SQLITE_PATH)
            self.conn.row_factory = sqlite3.Row
            self.backend = "sqlite"
        log.info("DB connected — backend: %s", self.backend)

    def _cursor(self):
        if self.backend == "postgres":
            return self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        return self.conn.cursor()

    @property
    def _ph(self):
        """Return the correct placeholder for the current backend."""
        return "%s" if self.backend == "postgres" else "?"

    def init_schema(self):
        """Create tables if they don't exist."""
        sql = SCHEMA_SQL_SQLITE if self.backend == "sqlite" else SCHEMA_SQL
        cur = self._cursor()
        cur.executescript(sql) if self.backend == "sqlite" else cur.execute(sql)
        self.conn.commit()
        log.info("Schema initialised.")

    def close(self):
        self.conn.close()

    # ── column name map from GAM CSV → DB columns ───────────────────────────

    COL_MAP = {
        # GAM API column name (snake_case after normalisation) → DB column
        # --- Dot-prefixed format (from CSV_DUMP download) ---
        "dimension.ad_unit_name":                       "ad_unit_name",
        "dimension.ad_unit_id":                         "ad_unit_id",
        "column.ad_server_impressions":                 "impressions",
        "column.ad_server_clicks":                      "clicks",
        "column.ad_server_ad_requests":                 "ad_requests",
        "column.ad_server_fill_rate":                   "fill_rate_pct",
        "column.ad_server_ctr":                         "ctr_pct",
        "column.ad_server_cpn_and_cpc_revenue":         "revenue_usd",
        "column.ad_server_cpm_and_cpc_revenue":         "revenue_usd",
        "column.ad_server_without_cpd_average_ecpm":    "ecpm_usd",
        # --- Underscore-prefixed format (alternate normalisation) ---
        "dimension_ad_unit_name": "ad_unit_name",
        "dimension_ad_unit_id":   "ad_unit_id",
        "column_ad_server_impressions":         "impressions",
        "column_ad_server_clicks":              "clicks",
        "column_ad_server_ad_requests":         "ad_requests",
        "column_ad_server_fill_rate":           "fill_rate_pct",
        "column_ad_server_ctr":                 "ctr_pct",
        "column_ad_server_cpn_and_cpc_revenue": "revenue_usd",
        "column_ad_server_cpm_and_cpc_revenue": "revenue_usd",
        "column_ad_server_without_cpd_average_ecpm": "ecpm_usd",
        # --- Plain names (no prefix) ---
        "ad_unit_name":           "ad_unit_name",
        "ad_unit_id":             "ad_unit_id",
        "ad_server_impressions":                "impressions",
        "ad_server_clicks":                     "clicks",
        "ad_server_ad_requests":                "ad_requests",
        "ad_server_fill_rate":                  "fill_rate_pct",
        "ad_server_ctr":                        "ctr_pct",
        "ad_server_cpn_and_cpc_revenue":        "revenue_usd",
        "ad_server_cpm_and_cpc_revenue":        "revenue_usd",
        "ad_server_without_cpd_average_ecpm":        "ecpm_usd",
    }

    def _map_row(self, row: dict, network_code: str, report_date) -> dict:
        """Map a raw GAM CSV row to our DB columns."""
        mapped = {
            "network_code": network_code,
            "report_date":  str(report_date),
            "raw_row":      json.dumps(row),
        }
        for src, dst in self.COL_MAP.items():
            if src in row:
                val = row[src]
                if val is not None and str(val).strip() not in ("", "-", "nan"):
                    try:
                        mapped[dst] = float(val) if "." in str(val) else int(val)
                    except (ValueError, TypeError):
                        mapped[dst] = str(val)
        return mapped

    # ── upsert ────────────────────────────────────────────────────────────────

    def upsert_revenue_rows(self, df: pd.DataFrame, network_code: str):
        """
        Insert or update revenue rows from a downloaded report DataFrame.
        UNIQUE constraint: (network_code, report_date, ad_unit_id).
        """
        cur = self._cursor()
        inserted = 0
        updated  = 0

        date_col = next((c for c in df.columns if "date" in c), None)

        for _, row in df.iterrows():
            row_dict = {k: (None if pd.isna(v) else v) for k, v in row.items()}

            report_date = row_dict.get(date_col, str(date.today()))
            mapped = self._map_row(row_dict, network_code, report_date)

            if self.backend == "postgres":
                sql = """
                    INSERT INTO gam_revenue
                        (network_code, report_date, ad_unit_id, ad_unit_name,
                         impressions, clicks, ad_requests,
                         fill_rate_pct, ctr_pct, revenue_usd, ecpm_usd, raw_row)
                    VALUES
                        (%(network_code)s, %(report_date)s,
                         %(ad_unit_id)s,   %(ad_unit_name)s,
                         %(impressions)s,  %(clicks)s, %(ad_requests)s,
                         %(fill_rate_pct)s,%(ctr_pct)s,%(revenue_usd)s,
                         %(ecpm_usd)s,     %(raw_row)s)
                    ON CONFLICT (network_code, report_date, ad_unit_id)
                    DO UPDATE SET
                        impressions   = EXCLUDED.impressions,
                        clicks        = EXCLUDED.clicks,
                        ad_requests   = EXCLUDED.ad_requests,
                        fill_rate_pct = EXCLUDED.fill_rate_pct,
                        ctr_pct       = EXCLUDED.ctr_pct,
                        revenue_usd   = EXCLUDED.revenue_usd,
                        ecpm_usd      = EXCLUDED.ecpm_usd,
                        raw_row       = EXCLUDED.raw_row,
                        updated_at    = CURRENT_TIMESTAMP
                """
                cur.execute(sql, {**{
                    "ad_unit_id": None, "ad_unit_name": None,
                    "impressions": 0, "clicks": 0, "ad_requests": 0,
                    "fill_rate_pct": None, "ctr_pct": None,
                    "revenue_usd": None, "ecpm_usd": None,
                }, **mapped})
            else:
                # SQLite
                sql = """
                    INSERT OR REPLACE INTO gam_revenue
                        (network_code, report_date, ad_unit_id, ad_unit_name,
                         impressions, clicks, ad_requests,
                         fill_rate_pct, ctr_pct, revenue_usd, ecpm_usd, raw_row)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """
                cur.execute(sql, (
                    mapped.get("network_code"),
                    mapped.get("report_date"),
                    mapped.get("ad_unit_id"),
                    mapped.get("ad_unit_name"),
                    mapped.get("impressions", 0),
                    mapped.get("clicks", 0),
                    mapped.get("ad_requests", 0),
                    mapped.get("fill_rate_pct"),
                    mapped.get("ctr_pct"),
                    mapped.get("revenue_usd"),
                    mapped.get("ecpm_usd"),
                    mapped.get("raw_row"),
                ))
            inserted += 1

        self.conn.commit()
        log.info("Upserted %d rows for network %s", inserted, network_code)

    # ── query helpers (used by MCP server) ────────────────────────────────────

    def get_revenue_by_app(
        self,
        report_date: str,
        network_code: str = None,
        limit: int = 50,
    ) -> list[dict]:
        """Revenue per app for a given date, sorted by revenue desc."""
        cur = self._cursor()
        ph = self._ph
        nc_filter = f"AND network_code = {ph}" if network_code else ""
        params: list = [report_date]
        if network_code:
            params.append(network_code)
        params.append(limit)

        sql = f"""
            SELECT ad_unit_name, ad_unit_id,
                   impressions, clicks, ad_requests,
                   fill_rate_pct, ctr_pct, revenue_usd, ecpm_usd,
                   report_date, network_code
            FROM gam_revenue
            WHERE report_date = {ph} {nc_filter}
            ORDER BY revenue_usd DESC NULLS LAST
            LIMIT {ph}
        """
        cur.execute(sql, params)
        rows = cur.fetchall()
        return [dict(r) for r in rows]

    def get_revenue_trend(
        self,
        ad_unit_name: str,
        days: int = 30,
        network_code: str = None,
    ) -> list[dict]:
        """Daily revenue trend for a single app over the last N days."""
        cur = self._cursor()
        ph = self._ph
        params: list = [ad_unit_name, days]
        nc_filter = ""
        if network_code:
            nc_filter = f"AND network_code = {ph}"
            params.insert(1, network_code)

        sql = f"""
            SELECT report_date, revenue_usd, impressions, ecpm_usd
            FROM gam_revenue
            WHERE ad_unit_name = {ph} {nc_filter}
            ORDER BY report_date DESC
            LIMIT {ph}
        """
        cur.execute(sql, params)
        return [dict(r) for r in cur.fetchall()]

    def get_network_daily_total(
        self,
        report_date: str,
        network_code: str = None,
    ) -> dict:
        """Total revenue + impressions across all apps for a date."""
        cur = self._cursor()
        ph = self._ph
        params: list = [report_date]
        nc_filter = ""
        if network_code:
            nc_filter = f"AND network_code = {ph}"
            params.append(network_code)

        sql = f"""
            SELECT
                MIN(report_date)                   AS report_date,
                COUNT(DISTINCT ad_unit_name)       AS app_count,
                SUM(impressions)                   AS total_impressions,
                SUM(clicks)                        AS total_clicks,
                SUM(ad_requests)                   AS total_ad_requests,
                SUM(revenue_usd)                   AS total_revenue_usd,
                AVG(fill_rate_pct)                 AS avg_fill_rate,
                AVG(ecpm_usd)                      AS avg_ecpm,
                MAX(ad_unit_name) FILTER (
                    WHERE revenue_usd = (
                        SELECT MAX(revenue_usd) FROM gam_revenue
                        WHERE report_date = {ph} {nc_filter}
                    )
                )                                  AS top_app_name,
                MAX(revenue_usd)                   AS top_app_revenue
            FROM gam_revenue
            WHERE report_date = {ph} {nc_filter}
        """
        # params for subquery + outer query
        all_params = params + params
        cur.execute(sql, all_params)
        row = cur.fetchone()
        return dict(row) if row else {}

    def get_anomalies(
        self,
        report_date: str,
        threshold_pct: float = 20.0,
        lookback_days: int = 7,
    ) -> list[dict]:
        """
        Find apps where today's revenue dropped > threshold_pct %
        compared to their 7-day average.
        """
        cur = self._cursor()
        ph = self._ph

        if self.backend == "postgres":
            # PostgreSQL date arithmetic
            date_expr = f"CAST({ph} AS DATE) - INTERVAL '1 day' * {ph}"
        else:
            # SQLite date arithmetic
            date_expr = f"DATE({ph}, '-' || {ph} || ' days')"

        sql = f"""
            WITH recent AS (
                SELECT ad_unit_name,
                       AVG(revenue_usd) AS avg_revenue_7d
                FROM gam_revenue
                WHERE report_date >= {date_expr}
                  AND report_date < {ph}
                GROUP BY ad_unit_name
            ),
            today AS (
                SELECT ad_unit_name, revenue_usd AS today_revenue
                FROM gam_revenue
                WHERE report_date = {ph}
            )
            SELECT t.ad_unit_name,
                   t.today_revenue,
                   r.avg_revenue_7d,
                   ROUND(
                     (r.avg_revenue_7d - t.today_revenue) / r.avg_revenue_7d * 100, 2
                   ) AS drop_pct
            FROM today t
            JOIN recent r ON t.ad_unit_name = r.ad_unit_name
            WHERE r.avg_revenue_7d > 0
              AND (r.avg_revenue_7d - t.today_revenue) / r.avg_revenue_7d * 100 > {ph}
            ORDER BY drop_pct DESC
        """
        cur.execute(
            sql,
            (report_date, lookback_days, report_date, report_date, threshold_pct),
        )
        return [dict(r) for r in cur.fetchall()]

    def save_summary(self, summary: dict):
        """Save a daily summary (optionally with Claude AI text)."""
        cur = self._cursor()
        if self.backend == "postgres":
            sql = """
                INSERT INTO gam_revenue_summaries
                    (network_code, report_date, total_revenue,
                     total_impressions, total_clicks, app_count,
                     top_app_name, top_app_revenue, summary_text, anomalies)
                VALUES (%(network_code)s, %(report_date)s, %(total_revenue)s,
                        %(total_impressions)s, %(total_clicks)s, %(app_count)s,
                        %(top_app_name)s, %(top_app_revenue)s,
                        %(summary_text)s, %(anomalies)s)
                ON CONFLICT (report_date)
                DO UPDATE SET
                    total_revenue     = EXCLUDED.total_revenue,
                    summary_text      = EXCLUDED.summary_text,
                    anomalies         = EXCLUDED.anomalies
            """
            cur.execute(sql, summary)
        else:
            sql = """
                INSERT OR REPLACE INTO gam_revenue_summaries
                    (network_code, report_date, total_revenue,
                     total_impressions, total_clicks, app_count,
                     top_app_name, top_app_revenue, summary_text, anomalies)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            cur.execute(sql, (
                summary.get("network_code"),
                summary.get("report_date"),
                summary.get("total_revenue"),
                summary.get("total_impressions"),
                summary.get("total_clicks"),
                summary.get("app_count"),
                summary.get("top_app_name"),
                summary.get("top_app_revenue"),
                summary.get("summary_text"),
                summary.get("anomalies"),
            ))
        self.conn.commit()


# ── CLI ────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="GAM 360 database utilities")
    parser.add_argument("--init", action="store_true", help="Initialise schema")
    parser.add_argument("--summary", help="Print revenue summary for date YYYY-MM-DD")
    args = parser.parse_args()

    db = RevenueDB()

    if args.init:
        db.init_schema()
        print("[OK] Schema created.")

    if args.summary:
        rows = db.get_revenue_by_app(args.summary)
        if not rows:
            print(f"No data found for {args.summary}")
        else:
            df = pd.DataFrame(rows)
            print(f"\n── Revenue by App — {args.summary} ──")
            print(df[["ad_unit_name", "revenue_usd", "impressions", "ecpm_usd"]].to_string(index=False))
            total = df["revenue_usd"].sum()
            print(f"\nNetwork total revenue: ${total:,.4f}")

    db.close()


if __name__ == "__main__":
    main()
