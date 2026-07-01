import { NextResponse } from "next/server";
import { getRevenueByApp, getLatestReportDate } from "@/services/api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let date = searchParams.get("date");

  // Fallback to latest available date if none provided
  if (!date) {
    const latestDate = await getLatestReportDate();
    date = latestDate || new Date().toISOString().split("T")[0];
  }

  const data = await getRevenueByApp(date);

  // Generate CSV content
  const header = [
    "Date",
    "App Name",
    "Ad Unit ID",
    "Network Code",
    "Revenue (USD)",
    "Impressions",
    "Clicks",
    "Ad Requests",
    "Fill Rate (%)",
    "CTR (%)",
    "eCPM (USD)"
  ].join(",");

  const rows = data.map((row) =>
    [
      row.report_date,
      `"${row.ad_unit_name}"`, // Quote strings to handle commas
      `"${row.ad_unit_id}"`,
      `"${row.network_code}"`,
      row.revenue_usd,
      row.impressions,
      row.clicks,
      row.ad_requests,
      row.fill_rate_pct,
      row.ctr_pct,
      row.ecpm_usd,
    ].join(",")
  );

  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="gam_revenue_report_${date}.csv"`,
    },
  });
}
