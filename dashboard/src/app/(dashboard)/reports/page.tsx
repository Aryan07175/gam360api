"use client";

import { useEffect, useState } from "react";
import { getReportHistory, triggerReportGeneration } from "@/services/api";
import { ReportHistoryItem } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { Play, Download, Trash2, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";

export default function ReportsPage() {
  const [history, setHistory] = useState<ReportHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [datePreset, setDatePreset] = useState("yesterday");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    async function load() {
      const data = await getReportHistory();
      setHistory(data);
      setLoading(false);
    }
    load();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    const result = await triggerReportGeneration({});
    
    setHistory((prev) => [
      {
        id: result.id,
        name: "Custom Generation Request",
        date: new Date().toISOString().split("T")[0],
        status: "Queued",
        rows: 0,
      },
      ...prev,
    ]);

    // Simulate transition to Running state
    setTimeout(() => {
      setGenerating(false);
      setHistory((prev) =>
        prev.map((item) =>
          item.id === result.id ? { ...item, status: "Running" } : item
        )
      );

      // Simulate transition to Completed state
      setTimeout(() => {
        setHistory((prev) =>
          prev.map((item) =>
            item.id === result.id
              ? { ...item, status: "Completed", rows: Math.floor(Math.random() * 5000) + 100 }
              : item
          )
        );
      }, 3000);
    }, 1500);
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Report Generator</h2>
        <p className="text-muted-foreground">
          Extract custom dimensions and metrics from GAM.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Generator Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>New Report</CardTitle>
            <CardDescription>Configure parameters for the API extraction.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Date Preset</Label>
              <Select value={datePreset} onValueChange={(val) => setDatePreset(val || "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select preset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="last7days">Last 7 Days</SelectItem>
                  <SelectItem value="last30days">Last 30 Days</SelectItem>
                  <SelectItem value="thismonth">This Month</SelectItem>
                  <SelectItem value="custom">Custom Range...</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDatePreset("custom");
                  }} 
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDatePreset("custom");
                  }} 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Dimensions</Label>
              <Select defaultValue="app">
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

            <Button 
              className="w-full mt-4" 
              onClick={handleGenerate} 
              disabled={generating}
            >
              {generating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {generating ? "Queuing..." : "Generate Report"}
            </Button>
          </CardContent>
        </Card>

        {/* History Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Report History</CardTitle>
            <CardDescription>Recently generated and scheduled reports.</CardDescription>
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
                    <TableCell colSpan={5} className="h-24 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : (
                  history.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.date}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <StatusIcon status={item.status} />
                          <span className={
                            item.status === "Completed" ? "text-emerald-500" :
                            item.status === "Failed" ? "text-red-500" : 
                            "text-muted-foreground"
                          }>
                            {item.status}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{item.rows.toLocaleString()}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="icon" disabled={item.status !== "Completed"}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
