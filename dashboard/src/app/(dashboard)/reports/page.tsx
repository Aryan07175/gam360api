"use client";

import { useEffect, useState, useCallback } from "react";
import { getReportHistory, triggerReportGeneration } from "@/services/api";
import { ReportHistoryItem } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Play, Download, Trash2, CheckCircle2, XCircle, Clock,
  Loader2, RefreshCw, CalendarDays, Database,
} from "lucide-react";
import { useDateContext } from "@/contexts/DateContext";
import { format, subDays, parseISO, startOfMonth } from "date-fns";

export default function ReportsPage() {
  const { selectedDate, latestDate, refreshKey } = useDateContext();

  const [history, setHistory] = useState<ReportHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Report generation config
  const [datePreset, setDatePreset] = useState("yesterday");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dimensions, setDimensions] = useState("app");

  // Derive start/end from preset whenever it changes (or when latestDate arrives)
  useEffect(() => {
    if (!latestDate || datePreset === "custom") return;

    const latest = parseISO(latestDate);
    let start: string;
    let end: string = latestDate;

    switch (datePreset) {
      case "yesterday":
        start = format(subDays(latest, 1), "yyyy-MM-dd");
        end = format(subDays(latest, 1), "yyyy-MM-dd");
        break;
      case "last7days":
        start = format(subDays(latest, 6), "yyyy-MM-dd");
        break;
      case "last30days":
        start = format(subDays(latest, 29), "yyyy-MM-dd");
        break;
      case "thismonth":
        start = format(startOfMonth(latest), "yyyy-MM-dd");
        break;
      default:
        return;
    }

    setStartDate(start);
    setEndDate(end);
  }, [datePreset, latestDate]);

  const load = useCallback(async () => {
    const data = await getReportHistory();
    setHistory(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // Poll while jobs are active
  useEffect(() => {
    const hasActive = history.some(
      (h) => h.status === "Queued" || h.status === "Running"
    );
    if (!hasActive) return;

    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, [history, load]);

  const handleGenerate = async () => {
    if (!startDate || !endDate) {
      alert("Please select a date range before generating a report.");
      return;
    }
    setGenerating(true);
    await triggerReportGeneration({ datePreset, startDate, endDate, dimensions });
    await load();
    setGenerating(false);
  };

  const handleDownload = (item: ReportHistoryItem) => {
    // Use the report's date range for the export
    const url = `/api/export?date=${item.date}`;
    window.location.href = url;
  };

  const handleDelete = async (item: ReportHistoryItem) => {
    setDeletingId(item.id);
    try {
      await fetch(`/api/reports/${item.id}`, { method: "DELETE" });
    } catch {
      // If endpoint doesn't exist, remove locally for UX
    }
    setHistory((prev) => prev.filter((h) => h.id !== item.id));
    setDeletingId(null);
  };

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case "Completed":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500 mr-2" />;
      case "Failed":
        return <XCircle className="h-4 w-4 text-red-500 mr-2" />;
      case "Running":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin mr-2" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground mr-2" />;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "Completed": return "text-emerald-500";
      case "Failed": return "text-red-500";
      case "Running": return "text-blue-500";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Report Generator</h2>
          <p className="text-muted-foreground">
            Extract custom dimensions and metrics from GAM.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Generator Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-indigo-500" />
              New Report
            </CardTitle>
            <CardDescription>Configure parameters for the GAM extraction.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date Preset */}
            <div className="space-y-2">
              <Label>Date Range</Label>
              <Select
                value={datePreset}
                onValueChange={(val) => {
                  setDatePreset(val || "yesterday");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select preset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="last7days">Last 7 Days</SelectItem>
                  <SelectItem value="last30days">Last 30 Days</SelectItem>
                  <SelectItem value="thismonth">This Month</SelectItem>
                  <SelectItem value="custom">Custom Range…</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Inputs — always visible, auto-populated from preset */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date</Label>
                <input
                  type="date"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={startDate}
                  max={latestDate || undefined}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDatePreset("custom");
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End Date</Label>
                <input
                  type="date"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={endDate}
                  max={latestDate || undefined}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDatePreset("custom");
                  }}
                />
              </div>
            </div>

            {/* Computed date range label */}
            {startDate && endDate && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                📅 {format(parseISO(startDate), "MMM dd")} → {format(parseISO(endDate), "MMM dd, yyyy")}
              </p>
            )}

            {/* Dimensions */}
            <div className="space-y-2">
              <Label>Dimensions</Label>
              <Select value={dimensions} onValueChange={(val) => setDimensions(val || "app")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select dimensions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="app">APP</SelectItem>
                  <SelectItem value="date_app">DATE, APP</SelectItem>
                  <SelectItem value="country">COUNTRY</SelectItem>
                  <SelectItem value="device">DEVICE</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Metrics summary */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Included Metrics</p>
              {["Revenue (USD)", "Impressions", "Clicks", "Ad Requests", "Fill Rate", "CTR", "eCPM"].map((m) => (
                <div key={m} className="flex items-center gap-2 text-xs text-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                  {m}
                </div>
              ))}
            </div>

            <Button
              className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleGenerate}
              disabled={generating || !startDate || !endDate}
            >
              {generating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {generating ? "Queuing…" : "Generate Report"}
            </Button>

            {/* Quick download of current dashboard date */}
            {selectedDate && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  window.location.href = `/api/export?date=${selectedDate}`;
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Today's View ({format(parseISO(selectedDate), "MMM dd")})
              </Button>
            )}
          </CardContent>
        </Card>

        {/* History Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-indigo-500" />
                  Report History
                </CardTitle>
                <CardDescription>Recently generated and scheduled reports.</CardDescription>
              </div>
              {history.some((h) => h.status === "Queued" || h.status === "Running") && (
                <Badge variant="outline" className="border-blue-400 text-blue-500 animate-pulse">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Processing…
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      No reports yet. Generate your first report using the panel on the left.
                    </TableCell>
                  </TableRow>
                ) : (
                  history.map((item) => (
                    <TableRow key={item.id} className="group">
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{item.date}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <StatusIcon status={item.status} />
                          <span className={statusColor(item.status)}>{item.status}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.status === "Completed"
                          ? item.rows.toLocaleString()
                          : item.status === "Running"
                          ? <span className="text-blue-500">—</span>
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                            disabled={item.status !== "Completed"}
                            onClick={() => handleDownload(item)}
                            title={item.status === "Completed" ? "Download CSV" : "Report not ready"}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => handleDelete(item)}
                            disabled={deletingId === item.id}
                            title="Delete report"
                          >
                            {deletingId === item.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <Trash2 className="h-4 w-4" />
                            }
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
