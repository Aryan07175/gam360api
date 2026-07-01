"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  icon?: React.ReactNode;
  loading?: boolean;
}

export function KPICard({ title, value, change, icon, loading }: KPICardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-10 items-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col space-y-1">
            <span className="text-2xl font-bold tracking-tight">{value}</span>
            {change !== undefined && (
              <div className="flex items-center text-xs">
                {isPositive ? (
                  <ArrowUp className="mr-1 h-3 w-3 text-emerald-500" />
                ) : isNegative ? (
                  <ArrowDown className="mr-1 h-3 w-3 text-red-500" />
                ) : null}
                <span
                  className={cn(
                    "font-medium",
                    isPositive ? "text-emerald-500" : isNegative ? "text-red-500" : "text-muted-foreground"
                  )}
                >
                  {Math.abs(change)}%
                </span>
                <span className="ml-1 text-muted-foreground">vs last week</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
