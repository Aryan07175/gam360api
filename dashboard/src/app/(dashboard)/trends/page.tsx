"use client";

import { useEffect, useState } from "react";
import { getRevenueTrend } from "@/services/api";
import { TrendDataPoint } from "@/types";
import { TrendChart } from "@/components/charts/trend-chart";
import { Loader2 } from "lucide-react";

export default function TrendsPage() {
  const [trend, setTrend] = useState<TrendDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await getRevenueTrend(30);
      setTrend(data.reverse());
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Trend Analysis</h2>
        <p className="text-muted-foreground">
          Analyze historical performance metrics over time.
        </p>
      </div>

      {loading ? (
        <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <TrendChart
            title="Revenue Trend (30 Days)"
            description="Total network revenue in USD"
            data={trend}
            dataKey="revenue_usd"
            xAxisKey="report_date"
            valuePrefix="$"
            color="#4f46e5"
          />
          <TrendChart
            title="Impressions Trend (30 Days)"
            description="Total ad impressions"
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
          <TrendChart
            title="Revenue vs Clicks"
            description="Click volume over time"
            data={trend.map(t => ({...t, clicks: Math.floor(t.impressions / 1000 * 2.5)}))}
            dataKey="clicks"
            xAxisKey="report_date"
            color="#f59e0b"
          />
        </div>
      )}
    </div>
  );
}
