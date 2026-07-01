# GAM 360 Revenue Pipeline — MCP Architecture

## High-Level Architecture

```mermaid
graph TB
    subgraph Claude_Desktop["Claude Desktop Application"]
        User["User Prompt"]
        Claude["Claude AI"]
        MCP_Client["MCP Client (stdio)"]
    end

    subgraph MCP_Server["MCP Server (gam360-revenue)"]
        Server["server.py"]
        Tools["7 MCP Tools"]
    end

    subgraph Backend["Backend Services"]
        Extractor["GAM Extractor"]
        DB["Database Layer"]
        Reporter["Report Generator"]
    end

    subgraph External["External Services"]
        GAM_API["GAM 360 SOAP API"]
        Neon["Neon PostgreSQL"]
        Slack["Slack Webhook"]
    end

    subgraph Storage["Local Storage"]
        CSV["CSV Reports"]
        MD["Markdown Reports"]
        Creds["Service Account JSON"]
    end

    User -->|"Ask question"| Claude
    Claude -->|"Call tool"| MCP_Client
    MCP_Client <-->|"stdio JSON-RPC"| Server
    Server --> Tools

    Tools -->|"Query data"| DB
    Tools -->|"Trigger extraction"| Extractor
    Tools -->|"Generate report"| Reporter

    Extractor -->|"SOAP API call"| GAM_API
    Extractor -->|"Save rows"| DB
    Extractor -->|"Export"| CSV

    DB <-->|"SQL queries"| Neon
    Reporter -->|"Write"| MD

    Server -.->|"Auth via"| Creds

    classDef claude fill:#6B4C9A,stroke:#4A3570,stroke-width:2px,color:white
    classDef mcp fill:#2D7D46,stroke:#1B5E30,stroke-width:2px,color:white
    classDef backend fill:#1565C0,stroke:#0D47A1,stroke-width:2px,color:white
    classDef external fill:#E65100,stroke:#BF360C,stroke-width:2px,color:white
    classDef storage fill:#37474F,stroke:#263238,stroke-width:2px,color:white

    class User,Claude,MCP_Client claude
    class Server,Tools mcp
    class Extractor,DB,Reporter backend
    class GAM_API,Neon,Slack external
    class CSV,MD,Creds storage
```

---

## MCP Communication Flow

```mermaid
sequenceDiagram
    actor User
    participant Claude as Claude Desktop
    participant MCP as MCP Server (stdio)
    participant DB as PostgreSQL (Neon)
    participant GAM as GAM 360 API

    User->>Claude: "Show yesterday's revenue by app"
    Claude->>MCP: call_tool("get_revenue_by_app", {date: "yesterday"})
    MCP->>DB: SELECT ... FROM gam_revenue WHERE report_date = ...
    DB-->>MCP: 79 rows (JSON)
    MCP-->>Claude: {status: "ok", apps: [...], total_revenue_usd: 0.4273}
    Claude-->>User: Formatted revenue table with insights

    Note over User,GAM: If data is missing, Claude triggers a fresh pull

    User->>Claude: "Pull fresh data for June 28th"
    Claude->>MCP: call_tool("run_fresh_extraction", {date: "2026-06-28"})
    MCP->>GAM: runReportJob (SOAP)
    GAM-->>MCP: job_id: 17690651725
    MCP->>GAM: getReportJobStatus (poll)
    GAM-->>MCP: COMPLETED
    MCP->>GAM: Download CSV
    GAM-->>MCP: 79 rows CSV
    MCP->>DB: UPSERT 79 rows
    MCP-->>Claude: {status: "ok", rows: 79}
    Claude-->>User: "Extracted 79 rows for June 28th"
```

---

## MCP Server — Tool Reference

```mermaid
graph LR
    subgraph MCP_Tools["gam360-revenue MCP Tools"]
        T1["get_revenue_by_app"]
        T2["get_revenue_trend"]
        T3["get_network_total"]
        T4["detect_anomalies"]
        T5["run_fresh_extraction"]
        T6["save_daily_summary"]
        T7["generate_report"]
    end

    subgraph Categories[""]
        Read["📊 Read Data"]
        Write["💾 Write Data"]
        Extract["🔄 Live API"]
    end

    T1 --> Read
    T2 --> Read
    T3 --> Read
    T4 --> Read
    T5 --> Extract
    T6 --> Write
    T7 --> Write

    style Read fill:#1B5E20,color:white
    style Write fill:#E65100,color:white
    style Extract fill:#1565C0,color:white
```

| Tool | Purpose | Input | Output |
|------|---------|-------|--------|
| `get_revenue_by_app` | Revenue per app for a date | `date`, `limit` | App list with revenue, impressions, eCPM |
| `get_revenue_trend` | Daily trend for one app | `app_name`, `days` | Time series of revenue data |
| `get_network_total` | Network-level daily summary | `date` | Total revenue, impressions, top app |
| `detect_anomalies` | Find revenue drops vs 7-day avg | `date`, `threshold_pct` | Apps with significant drops |
| `run_fresh_extraction` | Pull live data from GAM API | `date` | Row count extracted |
| `save_daily_summary` | Save AI summary to DB | `date`, `summary_text` | Confirmation |
| `generate_report` | Create markdown report file | `date`, `include_trends` | Report file path |

---

## Data Flow Through the System

```mermaid
flowchart TD
    A["GAM 360 Dashboard\n(Google Ad Manager)"] -->|"SOAP API\nReportService"| B["GAM Extractor\ngam_extractor.py"]
    
    B -->|"Raw CSV\n(micros → USD)"| C["CSV File\nreports/output/"]
    B -->|"UPSERT rows"| D[("Neon PostgreSQL\ngam_revenue table")]
    
    D -->|"SQL Queries"| E["MCP Server\nserver.py"]
    E -->|"JSON over stdio"| F["Claude Desktop\n(AI Assistant)"]
    
    D -->|"Anomaly Detection\n7-day avg comparison"| G["Alert Engine"]
    G -->|"Webhook POST"| H["Slack Channel"]
    
    D -->|"Report Queries"| I["Report Generator"]
    I -->|"Markdown"| J["Revenue Report\n.md file"]

    style A fill:#4285F4,color:white
    style B fill:#F4B400,color:black
    style D fill:#0F9D58,color:white
    style E fill:#2D7D46,color:white
    style F fill:#6B4C9A,color:white
    style H fill:#E01E5A,color:white
```

---

## File Structure & Responsibilities

```
gam360-pipeline/
├── config/
│   ├── .env                          # Environment variables (DB URL, network code)
│   ├── googleads.yaml                # GAM API auth config
│   ├── service_account.json          # GCP service account key
│   └── claude_desktop_config.json    # MCP server config for Claude Desktop
│
├── mcp_server/
│   └── server.py                     # MCP server — 7 tools exposed to Claude
│
├── extractor/
│   └── gam_extractor.py              # GAM 360 SOAP API data puller
│
├── database/
│   ├── db.py                         # DB layer (PostgreSQL + SQLite)
│   └── gam_revenue.db                # SQLite fallback (local dev)
│
├── reports/
│   └── output/                       # Generated CSV + Markdown reports
│
├── run_pipeline.py                   # Daily automation script (cron)
└── requirements.txt                  # Python dependencies
```

---

## How Claude Desktop Connects

```mermaid
flowchart LR
    subgraph Config["claude_desktop_config.json"]
        CMD["command:\n.venv/Scripts/python.exe"]
        ARGS["args:\nmcp_server/server.py"]
        ENV["env:\nGAM_NETWORK_CODE\nDATABASE_URL\nGAM_CREDENTIALS_PATH"]
    end

    subgraph Launch["On Claude Desktop Start"]
        Spawn["Spawn Process"]
        Stdio["stdio pipe\n(stdin/stdout)"]
    end

    subgraph Protocol["MCP Protocol"]
        Init["initialize"]
        List["tools/list → 7 tools"]
        Call["tools/call → execute"]
    end

    Config --> Spawn
    Spawn --> Stdio
    Stdio --> Init
    Init --> List
    List --> Call

    style Config fill:#37474F,color:white
    style Launch fill:#1565C0,color:white
    style Protocol fill:#2D7D46,color:white
```

---

## Database Schema

```mermaid
erDiagram
    gam_revenue {
        int id PK
        text network_code
        date report_date
        text ad_unit_id
        text ad_unit_name
        bigint impressions
        bigint clicks
        bigint ad_requests
        numeric fill_rate_pct
        numeric ctr_pct
        numeric revenue_usd
        numeric ecpm_usd
        jsonb raw_row
        timestamp created_at
        timestamp updated_at
    }

    gam_revenue_summaries {
        int id PK
        text network_code
        date report_date UK
        numeric total_revenue
        bigint total_impressions
        bigint total_clicks
        int app_count
        text top_app_name
        numeric top_app_revenue
        text summary_text
        text anomalies
        timestamp created_at
    }

    gam_revenue ||--o{ gam_revenue_summaries : "aggregated into"
```

> **Unique constraint**: `(network_code, report_date, ad_unit_id)` — ensures one row per app per day per network, with UPSERT on re-extraction.
