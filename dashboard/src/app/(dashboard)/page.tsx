"use client";

import { useEffect, useState } from "react";
import { DollarSign, MousePointerClick, Eye, Activity, Percent, ArrowRightLeft, AlertCircle } from "lucide-react";
import { KPICard } from "@/components/cards/kpi-card";
import { TrendChart } from "@/components/charts/trend-chart";
import { getNetworkTotal, getRevenueTrend } from "@/services/api";
import { NetworkTotal, TrendDataPoint } from "@/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useDateContext } from "@/contexts/DateContext";
import { format, parseISO } from "date-fns";

export default function DashboardOverview() {
  const { selectedDate, dateLoading, refreshKey } = useDateContext();
  const [total, setTotal] = useState<NetworkTotal | null>(null);
  const [trend, setTrend] = useState<TrendDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [noData, setNoData] = useState(false);

  useEffect(() => {
    if (dateLoading || !selectedDate) return;

    async function loadData() {
      setLoading(true);
      setNoData(false);

      const [totalData, trendData] = await Promise.all([
        getNetworkTotal(selectedDate!),
        getRevenueTrend(30),
      ]);

      if (!totalData) {
        setNoData(true);
      }

      setTotal(totalData);
      setTrend(trendData.reverse());
      setLoading(false);
    }
    loadData();
  }, [selectedDate, dateLoading, refreshKey]);

  const displayDate = selectedDate
    ? format(parseISO(selectedDate), "MMM dd, yyyy")
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
        <p className="text-muted-foreground">
          Monitor your network&apos;s high-level metrics and trends.
          {displayDate && (
            <span className="ml-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              • Showing data for {displayDate}
            </span>
          )}
        </p>
      </div>

      {/* No data warning banner */}
      {noData && !loading && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No data available for {displayDate}</AlertTitle>
          <AlertDescription>
            No revenue data was found in the database for this date.
            This typically means the GAM pipeline has not yet synced data for this day.
            Try selecting a different date using the date picker in the header.
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
