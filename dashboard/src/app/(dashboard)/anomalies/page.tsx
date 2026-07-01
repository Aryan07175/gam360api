"use client";

import { useEffect, useState } from "react";
import { getAnomalies } from "@/services/api";
import { Anomaly } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, TrendingDown, TrendingUp, Loader2, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await getAnomalies();
      setAnomalies(data);
      setLoading(false);
    }
    load();
  }, []);

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "High":
        return <Badge variant="destructive">High</Badge>;
      case "Medium":
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300">Medium</Badge>;
      case "Low":
        return <Badge variant="outline" className="text-muted-foreground">Low</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Anomaly Detection</h2>
        <p className="text-muted-foreground">
          AI-driven detection of revenue spikes, drops, and unusual patterns.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>How it works</AlertTitle>
        <AlertDescription>
          The system compares yesterday's performance against a rolling 7-day moving average.
          Statistical outliers are flagged automatically based on standard deviation thresholds.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Detected Anomalies</CardTitle>
          <CardDescription>Found {anomalies.length} potential issues requiring attention.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad Unit / Entity</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead className="text-right">Today's Revenue</TableHead>
                <TableHead className="text-right">7D Average</TableHead>
                <TableHead className="text-right">Deviation</TableHead>
                <TableHead className="text-right">AI Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : anomalies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No anomalies detected today. All systems normal.
                  </TableCell>
                </TableRow>
              ) : (
                anomalies.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">
                      <div className="flex items-center">
                        <AlertTriangle className="h-4 w-4 text-orange-500 mr-2" />
                        {item.ad_unit_name}
                      </div>
                    </TableCell>
                    <TableCell>{getSeverityBadge(item.severity)}</TableCell>
                    <TableCell className="text-right font-medium text-red-500">
                      ${item.today_revenue.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      ${item.avg_revenue_7d.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end text-red-500">
                        <TrendingDown className="mr-1 h-3 w-3" />
                        {item.drop_pct}%
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {(item.confidence * 100).toFixed(0)}%
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
