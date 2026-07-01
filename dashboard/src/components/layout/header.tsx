"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, User, Calendar as CalendarIcon, RefreshCw, Download } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

export function Header() {
  const { setTheme, theme } = useTheme();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b bg-background px-6 shadow-sm">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Google Ad Manager 360 Analytics</h1>
        <div className="hidden h-5 w-px bg-border md:block" />
        <span className="hidden text-sm text-muted-foreground md:inline-block">Network: 22846411849</span>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" className="hidden sm:flex h-9 border-dashed">
          <CalendarIcon className="mr-2 h-4 w-4" />
          {format(new Date(), "MMM dd, yyyy")}
        </Button>
        
        <Button variant="outline" size="sm" className="hidden sm:flex h-9">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>

        <Button size="sm" className="hidden sm:flex h-9 bg-indigo-600 hover:bg-indigo-700 text-white">
          <Download className="mr-2 h-4 w-4" />
          Generate Report
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

        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-muted">
          <User className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
