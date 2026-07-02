"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import {
  Moon, Sun, User, Calendar as CalendarIcon, RefreshCw,
  Download, Database, Bell, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { format, parseISO, subDays, addDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { useDateContext } from "@/contexts/DateContext";

export function Header() {
  const { setTheme, theme } = useTheme();
  const router = useRouter();
  const { selectedDate, latestDate, dateLoading, setSelectedDate, refresh, refreshing } = useDateContext();
  const [showPicker, setShowPicker] = useState(false);

  const displayDate = selectedDate
    ? format(parseISO(selectedDate), "MMM dd, yyyy")
    : dateLoading
    ? "Loading..."
    : format(new Date(), "MMM dd, yyyy");

  const isLiveDate = selectedDate === latestDate && !!latestDate;

  const goToPrevDay = () => {
    if (!selectedDate) return;
    setSelectedDate(format(subDays(parseISO(selectedDate), 1), "yyyy-MM-dd"));
  };

  const goToNextDay = () => {
    if (!selectedDate || !latestDate) return;
    const next = addDays(parseISO(selectedDate), 1);
    const latest = parseISO(latestDate);
    if (next <= latest) {
      setSelectedDate(format(next, "yyyy-MM-dd"));
    }
  };

  const canGoNext = selectedDate && latestDate && selectedDate < latestDate;

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b bg-background px-6 shadow-sm">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Google Ad Manager 360 Analytics</h1>
        <div className="hidden h-5 w-px bg-border md:block" />
        <span className="hidden text-sm text-muted-foreground md:inline-block">Network: 22846411849</span>
      </div>

      <div className="flex items-center gap-3">
        {/* Date Selector */}
        <div className="hidden sm:flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={goToPrevDay}
            disabled={!selectedDate}
            title="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className={`h-9 border-dashed min-w-[180px] font-medium ${
                isLiveDate ? "border-emerald-500/50 text-emerald-600 dark:text-emerald-400" : ""
              }`}
              title={selectedDate ? `Viewing data as of ${displayDate}. Click to change.` : "Loading date..."}
              onClick={() => setShowPicker((v) => !v)}
            >
              {selectedDate ? (
                <Database className={`mr-2 h-4 w-4 ${isLiveDate ? "text-emerald-500" : "text-muted-foreground"}`} />
              ) : (
                <CalendarIcon className="mr-2 h-4 w-4" />
              )}
              {selectedDate ? `Data as of: ${displayDate}` : displayDate}
              {isLiveDate && (
                <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                  LIVE
                </span>
              )}
            </Button>

            {/* Date picker dropdown */}
            {showPicker && (
              <div className="absolute right-0 top-10 z-50 bg-background border rounded-xl shadow-xl p-4 w-64 animate-in fade-in slide-in-from-top-2 duration-200">
                <p className="text-xs text-muted-foreground font-medium mb-3 uppercase tracking-wider">Select Date</p>
                <input
                  type="date"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                  value={selectedDate || ""}
                  max={latestDate || undefined}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedDate(e.target.value);
                      setShowPicker(false);
                    }
                  }}
                />
                {latestDate && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs text-muted-foreground mb-2">Quick select:</p>
                    {[
                      { label: "Latest (Live)", date: latestDate },
                      { label: "Yesterday", date: format(subDays(parseISO(latestDate), 1), "yyyy-MM-dd") },
                      { label: "2 days ago", date: format(subDays(parseISO(latestDate), 2), "yyyy-MM-dd") },
                      { label: "7 days ago", date: format(subDays(parseISO(latestDate), 7), "yyyy-MM-dd") },
                    ].map(({ label, date }) => (
                      <button
                        key={label}
                        className={`w-full text-left text-sm px-3 py-1.5 rounded-md transition-colors hover:bg-muted ${
                          selectedDate === date ? "bg-muted font-medium text-foreground" : "text-muted-foreground"
                        }`}
                        onClick={() => {
                          setSelectedDate(date);
                          setShowPicker(false);
                        }}
                      >
                        {label} — {format(parseISO(date), "MMM dd")}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={goToNextDay}
            disabled={!canGoNext}
            title="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Close picker on outside click overlay */}
        {showPicker && (
          <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
        )}

        <Button
          variant="outline"
          size="sm"
          className={`hidden sm:flex h-9 ${refreshing ? "opacity-60" : ""}`}
          onClick={refresh}
          disabled={refreshing}
          title="Refresh live data from database"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>

        <Button
          size="sm"
          className="hidden sm:flex h-9 bg-indigo-600 hover:bg-indigo-700 text-white"
          onClick={() => {
            const url = selectedDate ? `/api/export?date=${selectedDate}` : "/api/export";
            window.location.href = url;
          }}
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full"
          onClick={() => router.push("/alerts")}
        >
          <Bell className="h-[1.2rem] w-[1.2rem]" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-600 border-2 border-background"></span>
          <span className="sr-only">View alerts</span>
        </Button>

        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-muted">
          <User className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
