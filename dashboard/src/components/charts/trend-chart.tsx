"use client";

import { 
  Area, 
  AreaChart, 
  ResponsiveContainer, 
  Tooltip, 
  XAxis, 
  YAxis,
  CartesianGrid
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface TrendChartProps {
  title: string;
  description?: string;
  data: any[];
  dataKey: string;
  xAxisKey: string;
  color?: string;
  valuePrefix?: string;
  valueSuffix?: string;
}

export function TrendChart({
  title,
  description,
  data,
  dataKey,
  xAxisKey,
  color = "#4f46e5", // Indigo-600
  valuePrefix = "",
  valueSuffix = "",
}: TrendChartProps) {
  return (
    <Card className="col-span-1">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`color-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis 
                dataKey={xAxisKey} 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={12} 
                tickLine={false}
                axisLine={false}
                dy={10}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={12} 
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${valuePrefix}${value.toLocaleString()}${valueSuffix}`}
                dx={-10}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--popover))", 
                  borderColor: "hsl(var(--border))",
                  borderRadius: "var(--radius)",
                  color: "hsl(var(--popover-foreground))"
                }}
                itemStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(value: any) => [`${valuePrefix}${Number(value).toLocaleString()}${valueSuffix}`, title]}
              />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#color-${dataKey})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
