# Pulse AI / GAM 360 Pipeline

Pulse AI is an automated pipeline and AI-powered dashboard that extracts, stores, visualizes, and analyzes Google Ad Manager (GAM) 360 revenue data. It includes a backend Python extractor, a PostgreSQL database (Neon), an MCP server for Claude Desktop integration, and a sleek Next.js front-end dashboard.

## Features

- **Automated Data Extraction**: Pulls daily revenue, impressions, clicks, and eCPM data from the GAM 360 SOAP API.
- **Robust Storage**: Stores extracted data in a PostgreSQL database (Neon) for production, or local SQLite for development.
- **MCP Server for Claude**: Includes a Model Context Protocol (MCP) server that enables Claude to query data, detect anomalies, generate reports, and trigger extractions natively.
- **Beautiful Dashboard**: A modern, dark-themed Next.js dashboard featuring:
  - High-level KPIs (Revenue, Impressions, eCPM, Fill Rate, Daily Active Users).
  - Top Performing Apps leaderboards with visual health/trend indicators.
  - Interactive Recharts-based trend visualizations explicitly styled for dark mode visibility.
- **Automated Alerts**: Runs daily anomaly detection and sends alerts via Slack webhook.

## Architecture

See [`MCP_ARCHITECTURE.md`](./MCP_ARCHITECTURE.md) for detailed diagrams of the system architecture and MCP communication flows.

### Core Components
1. **Extractor** (`extractor/gam_extractor.py`): Interfaces with the Google Ads API using SOAP.
2. **Database** (`database/db.py`): Manages the schema and upsert logic.
3. **MCP Server** (`mcp_server/server.py`): Exposes GAM data as interactive tools for Claude via `stdio`.
4. **Dashboard** (`dashboard/`): Next.js web application built with Tailwind CSS, lucide-react, and Recharts.

## Setup Instructions

See [`config/SETUP_GUIDE.md`](./config/SETUP_GUIDE.md) for detailed configuration steps.

### 1. Repository Setup
```bash
git clone https://github.com/Aryan07175/gam360api.git
cd gam360api
```

### 2. Backend Setup
Install Python dependencies:
```bash
pip install -r requirements.txt
```
Configure your environment:
- Copy `config/.env.example` to `config/.env` and fill in your details (GAM network code, Neon PostgreSQL URL).
- Place your `googleads.yaml` and `service_account.json` in the `config/` directory.

### 3. Dashboard Setup
Start the front-end application:
```bash
cd dashboard
npm install
npm run dev
```

## Usage

### Run the Pipeline Manually
You can extract data for a specific date range:
```bash
python run_pipeline.py --start 2026-06-01 --end 2026-07-06
```
Or run the daily default:
```bash
python run_pipeline.py
```

### Start the MCP Server
To test the MCP server independently:
```bash
python mcp_server/server.py
```

## Recent Updates
- Implemented **Daily Active Users (DAU)** KPI based on GAM ad requests.
- Added a **Top Performing Apps** card to the dashboard overview.
- Improved **Recharts dark mode visibility** (custom tick colors, visible grid lines, vibrant graph lines) across all trend charts.
