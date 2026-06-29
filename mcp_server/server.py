"""
mcp_server/server.py
====================
MCP server that exposes GAM 360 revenue data as tools Claude can call.

Tools available to Claude:
  • get_revenue_by_app       — revenue per app for a date
  • get_revenue_trend        — revenue trend for one app
  • get_network_total        — network-level daily total
  • detect_anomalies         — apps with revenue drops
  • run_fresh_extraction     — trigger live GAM SOAP API pull
  • save_daily_summary       — save Claude's summary to DB
  • generate_report          — produce a formatted report file

Start the server:
  python mcp_server/server.py

Claude connects to this via stdio (MCP stdio transport).
"""

import os
import sys
import json
import logging
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp import types

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from database.db import RevenueDB

load_dotenv(Path(__file__).resolve().parent.parent / "config" / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("gam_mcp")

NETWORK_CODE    = os.getenv("GAM_NETWORK_CODE", "")
ANOMALY_THRESH  = float(os.getenv("ANOMALY_THRESHOLD_PCT", "20"))
REPORTS_DIR     = Path(os.getenv("REPORTS_OUTPUT_DIR", "reports/output"))

app = Server("gam360-revenue-mcp")


def _db() -> RevenueDB:
    return RevenueDB()


def _yesterday() -> str:
    return str(date.today() - timedelta(days=1))


# ── Tool definitions ──────────────────────────────────────────────────────────

@app.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="get_revenue_by_app",
            description=(
                "Get revenue, impressions, eCPM and fill rate broken down "
                "by app (ad unit) for a specific date. Returns data that "
                "matches the GAM 360 dashboard 'Apps' report."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "date": {
                        "type": "string",
                        "description": "Date in YYYY-MM-DD format, or 'yesterday'",
                    },
                    "network_code": {
                        "type": "string",
                        "description": "GAM network code (optional, uses env default)",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max number of apps to return (default 50)",
                        "default": 50,
                    },
                },
                "required": ["date"],
            },
        ),
        types.Tool(
            name="get_revenue_trend",
            description=(
                "Get daily revenue trend for a single app over the last N days. "
                "Useful for spotting patterns and week-over-week changes."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "app_name": {
                        "type": "string",
                        "description": "Ad unit / app name (as it appears in GAM)",
                    },
                    "days": {
                        "type": "integer",
                        "description": "Number of days to look back (default 30)",
                        "default": 30,
                    },
                },
                "required": ["app_name"],
            },
        ),
        types.Tool(
            name="get_network_total",
            description=(
                "Get the total network-level revenue, impressions and top "
                "performing app for a specific date."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "date": {
                        "type": "string",
                        "description": "Date in YYYY-MM-DD format, or 'yesterday'",
                    },
                },
                "required": ["date"],
            },
        ),
        types.Tool(
            name="detect_anomalies",
            description=(
                "Find apps where revenue dropped significantly compared to "
                "their 7-day average. Returns app name, today's revenue, "
                "average, and % drop."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "date": {
                        "type": "string",
                        "description": "Date to check (YYYY-MM-DD or 'yesterday')",
                    },
                    "threshold_pct": {
                        "type": "number",
                        "description": "% drop that counts as anomaly (default 20)",
                        "default": 20,
                    },
                },
                "required": ["date"],
            },
        ),
        types.Tool(
            name="run_fresh_extraction",
            description=(
                "Trigger a live data pull from the GAM 360 SOAP API for a "
                "given date. Use this when you need fresh data not yet in "
                "the database. Returns a status message."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "date": {
                        "type": "string",
                        "description": "Date to extract (YYYY-MM-DD or 'yesterday')",
                    },
                },
                "required": ["date"],
            },
        ),
        types.Tool(
            name="save_daily_summary",
            description=(
                "Save an AI-generated daily revenue summary to the database. "
                "Call this after analysing the revenue data to persist insights."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "date": {"type": "string"},
                    "summary_text": {
                        "type": "string",
                        "description": "The AI-written summary of the day's revenue",
                    },
                    "anomalies": {
                        "type": "array",
                        "description": "List of anomaly dicts (from detect_anomalies)",
                    },
                    "total_revenue": {"type": "number"},
                    "top_app_name": {"type": "string"},
                },
                "required": ["date", "summary_text"],
            },
        ),
        types.Tool(
            name="generate_report",
            description=(
                "Generate a formatted Markdown revenue report for a date "
                "and save it to the reports directory. Returns the file path."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "date": {"type": "string"},
                    "include_trends": {
                        "type": "boolean",
                        "description": "Include 7-day trend for each app",
                        "default": False,
                    },
                },
                "required": ["date"],
            },
        ),
    ]


# ── Tool call handlers ────────────────────────────────────────────────────────

@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:

    # ── get_revenue_by_app ────────────────────────────────────────────────────
    if name == "get_revenue_by_app":
        raw_date = arguments.get("date", "yesterday")
        target   = str(date.today() - timedelta(1)) if raw_date == "yesterday" else raw_date
        nc       = arguments.get("network_code", NETWORK_CODE) or None
        limit    = int(arguments.get("limit", 50))

        db = _db()
        rows = db.get_revenue_by_app(target, network_code=nc, limit=limit)
        db.close()

        if not rows:
            result = {
                "status": "no_data",
                "date": target,
                "message": (
                    f"No revenue data in database for {target}. "
                    "Try running run_fresh_extraction first."
                ),
            }
        else:
            total_revenue = sum(r.get("revenue_usd") or 0 for r in rows)
            result = {
                "status": "ok",
                "date": target,
                "app_count": len(rows),
                "total_revenue_usd": round(total_revenue, 4),
                "apps": rows,
            }

        return [types.TextContent(type="text", text=json.dumps(result, indent=2, default=str))]

    # ── get_revenue_trend ─────────────────────────────────────────────────────
    elif name == "get_revenue_trend":
        app_name = arguments["app_name"]
        days     = int(arguments.get("days", 30))

        db = _db()
        rows = db.get_revenue_trend(app_name, days=days, network_code=NETWORK_CODE or None)
        db.close()

        result = {
            "app_name": app_name,
            "days":     days,
            "trend":    rows,
        }
        return [types.TextContent(type="text", text=json.dumps(result, indent=2, default=str))]

    # ── get_network_total ─────────────────────────────────────────────────────
    elif name == "get_network_total":
        raw_date = arguments.get("date", "yesterday")
        target   = str(date.today() - timedelta(1)) if raw_date == "yesterday" else raw_date

        db = _db()
        totals = db.get_network_daily_total(target, network_code=NETWORK_CODE or None)
        db.close()

        result = {"status": "ok", "date": target, **totals}
        return [types.TextContent(type="text", text=json.dumps(result, indent=2, default=str))]

    # ── detect_anomalies ──────────────────────────────────────────────────────
    elif name == "detect_anomalies":
        raw_date  = arguments.get("date", "yesterday")
        target    = str(date.today() - timedelta(1)) if raw_date == "yesterday" else raw_date
        threshold = float(arguments.get("threshold_pct", ANOMALY_THRESH))

        db = _db()
        anomalies = db.get_anomalies(target, threshold_pct=threshold)
        db.close()

        result = {
            "date":           target,
            "threshold_pct":  threshold,
            "anomaly_count":  len(anomalies),
            "anomalies":      anomalies,
        }
        return [types.TextContent(type="text", text=json.dumps(result, indent=2, default=str))]

    # ── run_fresh_extraction ──────────────────────────────────────────────────
    elif name == "run_fresh_extraction":
        raw_date = arguments.get("date", "yesterday")
        target   = str(date.today() - timedelta(1)) if raw_date == "yesterday" else raw_date

        try:
            # Import here to avoid circular deps and keep MCP server fast
            from extractor.gam_extractor import GAMRevenueExtractor
            from datetime import datetime

            d = datetime.strptime(target, "%Y-%m-%d").date()
            extractor = GAMRevenueExtractor()
            df = extractor.extract_revenue(d, d, save_to_db=True, save_csv=True)

            result = {
                "status":   "ok",
                "date":     target,
                "rows":     len(df),
                "message":  f"Extracted {len(df)} rows from GAM 360 for {target}.",
            }
        except Exception as e:
            result = {"status": "error", "message": str(e)}

        return [types.TextContent(type="text", text=json.dumps(result, indent=2))]

    # ── save_daily_summary ────────────────────────────────────────────────────
    elif name == "save_daily_summary":
        summary = {
            "network_code":    NETWORK_CODE,
            "report_date":     arguments["date"],
            "total_revenue":   arguments.get("total_revenue"),
            "total_impressions": arguments.get("total_impressions"),
            "total_clicks":    arguments.get("total_clicks"),
            "app_count":       arguments.get("app_count"),
            "top_app_name":    arguments.get("top_app_name"),
            "top_app_revenue": arguments.get("top_app_revenue"),
            "summary_text":    arguments["summary_text"],
            "anomalies":       json.dumps(arguments.get("anomalies", [])),
        }
        db = _db()
        db.save_summary(summary)
        db.close()

        result = {"status": "ok", "saved_for_date": arguments["date"]}
        return [types.TextContent(type="text", text=json.dumps(result, indent=2))]

    # ── generate_report ────────────────────────────────────────────────────────
    elif name == "generate_report":
        raw_date       = arguments.get("date", "yesterday")
        target         = str(date.today() - timedelta(1)) if raw_date == "yesterday" else raw_date
        include_trends = arguments.get("include_trends", False)

        db = _db()
        rows    = db.get_revenue_by_app(target, limit=100)
        totals  = db.get_network_daily_total(target)
        anomaly = db.get_anomalies(target, threshold_pct=ANOMALY_THRESH)
        db.close()

        total_rev = totals.get("total_revenue_usd", 0) or 0
        total_imp = totals.get("total_impressions", 0) or 0

        lines = [
            f"# GAM 360 Revenue Report — {target}",
            "",
            "## Network summary",
            "",
            f"| Metric | Value |",
            f"|--------|-------|",
            f"| Total revenue | ${total_rev:,.4f} |",
            f"| Total impressions | {int(total_imp):,} |",
            f"| Apps with data | {totals.get('app_count', len(rows))} |",
            f"| Top app | {totals.get('top_app_name', 'N/A')} |",
            "",
            "## Revenue by app",
            "",
            "| App name | Revenue (USD) | Impressions | eCPM | Fill rate % |",
            "|----------|--------------|-------------|------|-------------|",
        ]

        for r in rows:
            rev  = r.get("revenue_usd") or 0
            imp  = r.get("impressions") or 0
            ecpm = r.get("ecpm_usd") or 0
            fill = r.get("fill_rate_pct") or 0
            name_cell = (r.get("ad_unit_name") or "Unknown")[:40]
            lines.append(
                f"| {name_cell} | ${rev:,.4f} | {int(imp):,} | ${ecpm:,.3f} | {fill:.1f}% |"
            )

        if anomaly:
            lines += [
                "",
                f"## ⚠️ Revenue anomalies (>{ANOMALY_THRESH}% drop)",
                "",
                "| App | Today | 7-day avg | Drop % |",
                "|-----|-------|-----------|--------|",
            ]
            for a in anomaly:
                lines.append(
                    f"| {a.get('ad_unit_name','?')} | "
                    f"${a.get('today_revenue',0):,.4f} | "
                    f"${a.get('avg_revenue_7d',0):,.4f} | "
                    f"{a.get('drop_pct',0):.1f}% |"
                )

        report_text = "\n".join(lines)

        REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        report_path = REPORTS_DIR / f"revenue_report_{target}.md"
        report_path.write_text(report_text, encoding="utf-8")

        result = {
            "status":      "ok",
            "report_path": str(report_path),
            "preview":     report_text[:1000],
        }
        return [types.TextContent(type="text", text=json.dumps(result, indent=2))]

    else:
        return [types.TextContent(type="text", text=json.dumps({"error": f"Unknown tool: {name}"}))]


# ── entry point ────────────────────────────────────────────────────────────────

async def main():
    log.info("Starting GAM 360 Revenue MCP server …")
    async with stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            app.create_initialization_options(),
        )


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
