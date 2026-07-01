"use client";

import { useEffect, useState } from "react";
import { DollarSign, MousePointerClick, Eye, Activity, Percent, ArrowRightLeft, AlertCircle } from "lucide-react";
import { KPICard } from "@/components/cards/kpi-card";
import { TrendChart } from "@/components/charts/trend-chart";
import { getNetworkTotal, getRevenueTrend, getLatestReportDate } from "@/services/api";
import { NetworkTotal, TrendDataPoint } from "@/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function DashboardOverview() {
  const [total, setTotal] = useState<NetworkTotal | null>(null);
  const [trend, setTrend] = useState<TrendDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [noData, setNoData] = useState(false);
  const [dataDate, setDataDate] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setNoData(false);

      // Step 1: Determine the latest date with actual data in Postgres
      const latestDate = await getLatestReportDate();
      const dateToQuery = latestDate || new Date().toISOString().split("T")[0];
      setDataDate(latestDate);

      // Step 2: Fetch data for that date
      const [totalData, trendData] = await Promise.all([
        getNetworkTotal(dateToQuery),
        getRevenueTrend(30),
      ]);

      if (!totalData) {
        setNoData(true);
      }

      setTotal(totalData);
      setTrend(trendData.reverse()); // Chronological order
      setLoading(false);
    }
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
        <p className="text-muted-foreground">
          Monitor your network&apos;s high-level metrics and trends.
          {dataDate && (
            <span className="ml-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              • Showing data for {dataDate}
            </span>
          )}
        </p>
      </div>

      {/* No data warning banner */}
      {noData && !loading && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No data available</AlertTitle>
          <AlertDescription>
            No revenue data was found in the database for the selected date. 
            This typically means the GAM pipeline has not yet synced data for this day. 
            Try running the pipeline or selecting a different date.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Revenue"
          value={
            total
              ? `$${total.total_revenue_usd.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 6,
                })}`
              : noData ? "—" : "$0.00"
          }
          icon={<DollarSign className="h-4 w-4" />}
          loading={loading}
          subtitle={noData ? "No data for this date" : undefined}
        />
        <KPICard
          title="Impressions"
          value={total ? total.total_impressions.toLocaleString() : noData ? "—" : "0"}
          icon={<Eye className="h-4 w-4" />}
          loading={loading}
          subtitle={noData ? "No data for this date" : undefined}
        />
        <KPICard
          title="Clicks"
          value={total ? total.total_clicks.toLocaleString() : noData ? "—" : "0"}
          icon={<MousePointerClick className="h-4 w-4" />}
          loading={loading}
          subtitle={noData ? "No data for this date" : undefined}
        />
        <KPICard
          title="Avg eCPM"
          value={total ? `$${total.avg_ecpm.toFixed(6)}` : noData ? "—" : "$0.00"}
          icon={<Activity className="h-4 w-4" />}
          loading={loading}
          subtitle={noData ? "No data for this date" : undefined}
        />
        
        {/* ISSUE 2 FIX: Fill Rate shows N/A when null instead of 0.0% */}
        <KPICard
          title="Fill Rate"
          value={
            total
              ? total.avg_fill_rate !== null
                ? `${total.avg_fill_rate.toFixed(1)}%`
                : "N/A"
              : noData ? "—" : "N/A"
          }
          icon={<Percent className="h-4 w-4" />}
          loading={loading}
          subtitle={
            total && total.avg_fill_rate === null
              ? "No ad requests recorded for this date"
              : noData
              ? "No data for this date"
              : undefined
          }
        />
        <KPICard
          title="Ad Requests"
          value={total ? total.total_ad_requests.toLocaleString() : noData ? "—" : "0"}
          icon={<ArrowRightLeft className="h-4 w-4" />}
          loading={loading}
          subtitle={noData ? "No data for this date" : undefined}
        />
        <KPICard
          title="Top App"
          value={total?.top_app_name || (noData ? "—" : "N/A")}
          icon={<Activity className="h-4 w-4" />}
          loading={loading}
          subtitle={noData ? "No data for this date" : undefined}
        />
        <KPICard
          title="Top App Revenue"
          value={
            total
              ? `$${total.top_app_revenue.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 6,
                })}`
              : noData ? "—" : "$0.00"
          }
          icon={<DollarSign className="h-4 w-4" />}
          loading={loading}
          subtitle={noData ? "No data for this date" : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TrendChart
          title="Revenue Trend (30 Days)"
          description="Daily total revenue in USD"
          data={trend}
          dataKey="revenue_usd"
          xAxisKey="report_date"
          valuePrefix="$"
          color="#4f46e5"
        />
        <TrendChart
          title="Impressions Trend (30 Days)"
          description="Daily ad impressions"
          data={trend}
          dataKey="impressions"
          xAxisKey="report_date"
          color="#0ea5e9"
        />
        <TrendChart
          title="eCPM Trend (30 Days)"
          description="Average effective cost per mille"
          data={trend}
          dataKey="ecpm_usd"
          xAxisKey="report_date"
          valuePrefix="$"
          color="#10b981"
        />
      </div>
    </div>
  );
}
