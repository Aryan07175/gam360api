"use client";

import { useEffect, useState } from "react";
import { DollarSign, MousePointerClick, Eye, Activity, Percent, ArrowRightLeft } from "lucide-react";
import { KPICard } from "@/components/cards/kpi-card";
import { TrendChart } from "@/components/charts/trend-chart";
import { getNetworkTotal, getRevenueTrend } from "@/services/api";
import { NetworkTotal, TrendDataPoint } from "@/types";

export default function DashboardOverview() {
  const [total, setTotal] = useState<NetworkTotal | null>(null);
  const [trend, setTrend] = useState<TrendDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [totalData, trendData] = await Promise.all([
        getNetworkTotal(),
        getRevenueTrend(30),
      ]);
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
          Monitor your network's high-level metrics and trends.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Revenue"
          value={total ? `$${total.total_revenue_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$0.00"}
          change={12.5}
          icon={<DollarSign className="h-4 w-4" />}
          loading={loading}
        />
        <KPICard
          title="Impressions"
          value={total ? total.total_impressions.toLocaleString() : "0"}
          change={5.2}
          icon={<Eye className="h-4 w-4" />}
          loading={loading}
        />
        <KPICard
          title="Clicks"
          value={total ? total.total_clicks.toLocaleString() : "0"}
          change={-2.4}
          icon={<MousePointerClick className="h-4 w-4" />}
          loading={loading}
        />
        <KPICard
          title="Avg eCPM"
          value={total ? `$${total.avg_ecpm.toFixed(2)}` : "$0.00"}
          change={8.1}
          icon={<Activity className="h-4 w-4" />}
          loading={loading}
        />
        
        <KPICard
          title="Fill Rate"
          value={total ? `${total.avg_fill_rate.toFixed(1)}%` : "0%"}
          change={1.2}
          icon={<Percent className="h-4 w-4" />}
          loading={loading}
        />
        <KPICard
          title="Ad Requests"
          value={total ? total.total_ad_requests.toLocaleString() : "0"}
          change={4.0}
          icon={<ArrowRightLeft className="h-4 w-4" />}
          loading={loading}
        />
        <KPICard
          title="Top App"
          value={total?.top_app_name || "N/A"}
          icon={<Activity className="h-4 w-4" />}
          loading={loading}
        />
        <KPICard
          title="Top App Revenue"
          value={total ? `$${total.top_app_revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$0.00"}
          change={15.3}
          icon={<DollarSign className="h-4 w-4" />}
          loading={loading}
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
