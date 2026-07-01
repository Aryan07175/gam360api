import {
  AppMetrics,
  NetworkTotal,
  TrendDataPoint,
  Anomaly,
  ReportHistoryItem,
} from "../types";

const MOCK_DELAY = 800; // Simulate network latency

export async function getNetworkTotal(date: string = "2026-06-30"): Promise<NetworkTotal> {
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          report_date: date,
          app_count: 79,
          total_impressions: 102930,
          total_clicks: 450,
          total_ad_requests: 120500,
          total_revenue_usd: 1245.5,
          avg_fill_rate: 85.4,
          avg_ecpm: 12.1,
          top_app_name: "JBM_Aria_768x1216",
          top_app_revenue: 345.2,
        }),
      MOCK_DELAY
    )
  );
}

export async function getRevenueByApp(date: string = "2026-06-30"): Promise<AppMetrics[]> {
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve([
          {
            ad_unit_name: "JBM_Aria_768x1216",
            ad_unit_id: "1001",
            revenue_usd: 345.2,
            impressions: 25000,
            clicks: 120,
            ad_requests: 28000,
            fill_rate_pct: 89.2,
            ctr_pct: 0.48,
            ecpm_usd: 13.8,
            report_date: date,
            network_code: "22846411849",
          },
          {
            ad_unit_name: "JBM_Aria_1024x768",
            ad_unit_id: "1002",
            revenue_usd: 210.8,
            impressions: 18000,
            clicks: 95,
            ad_requests: 21000,
            fill_rate_pct: 85.7,
            ctr_pct: 0.52,
            ecpm_usd: 11.7,
            report_date: date,
            network_code: "22846411849",
          },
          {
            ad_unit_name: "JBM_travellingslacker.com",
            ad_unit_id: "1003",
            revenue_usd: 145.3,
            impressions: 12500,
            clicks: 45,
            ad_requests: 15000,
            fill_rate_pct: 83.3,
            ctr_pct: 0.36,
            ecpm_usd: 11.6,
            report_date: date,
            network_code: "22846411849",
          },
          {
            ad_unit_name: "JBM_rank1st.in_Bottomsticky",
            ad_unit_id: "1004",
            revenue_usd: 98.4,
            impressions: 9800,
            clicks: 30,
            ad_requests: 12000,
            fill_rate_pct: 81.6,
            ctr_pct: 0.3,
            ecpm_usd: 10.0,
            report_date: date,
            network_code: "22846411849",
          },
          {
            ad_unit_name: "JBM_Savepe.in_Display5",
            ad_unit_id: "1005",
            revenue_usd: 75.1,
            impressions: 8200,
            clicks: 25,
            ad_requests: 9500,
            fill_rate_pct: 86.3,
            ctr_pct: 0.3,
            ecpm_usd: 9.1,
            report_date: date,
            network_code: "22846411849",
          },
        ]),
      MOCK_DELAY
    )
  );
}

export async function getRevenueTrend(days: number = 30): Promise<TrendDataPoint[]> {
  return new Promise((resolve) => {
    const data: TrendDataPoint[] = [];
    const now = new Date();
    for (let i = days; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const baseRev = 1000 + Math.random() * 400;
      data.push({
        report_date: d.toISOString().split("T")[0],
        revenue_usd: baseRev,
        impressions: baseRev * 80 + Math.random() * 5000,
        ecpm_usd: 10 + Math.random() * 3,
      });
    }
    setTimeout(() => resolve(data), MOCK_DELAY);
  });
}

export async function getAnomalies(date: string = "2026-06-30"): Promise<Anomaly[]> {
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve([
          {
            ad_unit_name: "JBM_Savepe.in_336x280",
            today_revenue: 12.5,
            avg_revenue_7d: 45.2,
            drop_pct: 72.3,
            severity: "High",
            confidence: 0.95,
          },
          {
            ad_unit_name: "JBM_rank1st.in_336x280",
            today_revenue: 28.4,
            avg_revenue_7d: 51.0,
            drop_pct: 44.3,
            severity: "Medium",
            confidence: 0.82,
          },
        ]),
      MOCK_DELAY
    )
  );
}

export async function getReportHistory(): Promise<ReportHistoryItem[]> {
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve([
          {
            id: "1",
            name: "June Performance Review",
            date: "2026-06-30",
            status: "Completed",
            rows: 2450,
          },
          {
            id: "2",
            name: "Yesterday Anomalies",
            date: "2026-06-30",
            status: "Completed",
            rows: 15,
          },
          {
            id: "3",
            name: "Custom Top Apps (Q2)",
            date: "2026-06-29",
            status: "Failed",
            rows: 0,
          },
          {
            id: "4",
            name: "Daily Sync",
            date: "2026-06-29",
            status: "Completed",
            rows: 79,
          },
        ]),
      MOCK_DELAY
    )
  );
}

export async function triggerReportGeneration(config: any): Promise<{ id: string; status: string }> {
  return new Promise((resolve) =>
    setTimeout(() => resolve({ id: Math.random().toString(36).substring(7), status: "Queued" }), MOCK_DELAY)
  );
}
