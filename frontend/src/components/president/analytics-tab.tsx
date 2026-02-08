import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/auth";
import { getWeeklyAnalytics, getMonthlyHeatmap } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from "lucide-react";

interface WeeklyData {
  thisWeekTotal: number;
  lastWeekTotal: number;
  thisWeekCount: number;
  lastWeekCount: number;
  activeMembers: number;
  weekStartDate: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function heatColor(pct: number): string {
  if (pct === 0) return "bg-muted";
  if (pct <= 25) return "bg-red-200";
  if (pct <= 50) return "bg-orange-200";
  if (pct <= 75) return "bg-yellow-200";
  return "bg-green-300";
}

export default function PresidentAnalyticsTab() {
  const { profile } = useAuth();
  const [weekly, setWeekly] = useState<WeeklyData | null>(null);

  const now = new Date();
  const [heatmapYear, setHeatmapYear] = useState(now.getFullYear());
  const [heatmapMonth, setHeatmapMonth] = useState(now.getMonth() + 1);
  const [heatmap, setHeatmap] = useState<Map<string, number>>(new Map());
  const [totalMembers, setTotalMembers] = useState(0);

  const loadWeekly = useCallback(async () => {
    if (!profile?.class_id) return;
    const data = await getWeeklyAnalytics(profile.class_id);
    setWeekly(data);
  }, [profile?.class_id]);

  const loadHeatmap = useCallback(async () => {
    if (!profile?.class_id) return;
    const data = await getMonthlyHeatmap(profile.class_id, heatmapYear, heatmapMonth);
    setHeatmap(data.heatmap);
    setTotalMembers(data.totalMembers);
  }, [profile?.class_id, heatmapYear, heatmapMonth]);

  useEffect(() => {
    loadWeekly();
  }, [loadWeekly]);

  useEffect(() => {
    loadHeatmap();
  }, [loadHeatmap]);

  function prevMonth() {
    if (heatmapMonth === 1) {
      setHeatmapMonth(12);
      setHeatmapYear((y) => y - 1);
    } else {
      setHeatmapMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (heatmapMonth === 12) {
      setHeatmapMonth(1);
      setHeatmapYear((y) => y + 1);
    } else {
      setHeatmapMonth((m) => m + 1);
    }
  }

  if (!profile?.class_id) return null;

  // Calculate week-over-week change
  const wowChange =
    weekly && weekly.lastWeekTotal > 0
      ? ((weekly.thisWeekTotal - weekly.lastWeekTotal) / weekly.lastWeekTotal) * 100
      : null;

  // Build calendar grid
  const firstDay = new Date(heatmapYear, heatmapMonth - 1, 1);
  const daysInMonth = new Date(heatmapYear, heatmapMonth, 0).getDate();
  const startDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Monday = 0

  const calendarCells: Array<{ day: number; dateStr: string } | null> = [];
  for (let i = 0; i < startDow; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${heatmapYear}-${String(heatmapMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    calendarCells.push({ day: d, dateStr });
  }

  return (
    <div className="space-y-4">
      {/* Weekly Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" />
            This Week
            {weekly && (
              <span className="ml-auto text-xs font-normal">
                since{" "}
                {new Date(weekly.weekStartDate).toLocaleDateString("en-PH", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {weekly ? (
            <div className="space-y-4">
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold">
                  ₱{weekly.thisWeekTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </p>
                {wowChange !== null && (
                  <span
                    className={`flex items-center gap-0.5 text-sm font-medium ${
                      wowChange > 0
                        ? "text-green-600"
                        : wowChange < 0
                          ? "text-red-600"
                          : "text-muted-foreground"
                    }`}
                  >
                    {wowChange > 0 ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : wowChange < 0 ? (
                      <TrendingDown className="h-3.5 w-3.5" />
                    ) : (
                      <Minus className="h-3.5 w-3.5" />
                    )}
                    {Math.abs(wowChange).toFixed(0)}%
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-semibold">{weekly.thisWeekCount}</p>
                  <p className="text-xs text-muted-foreground">Payments</p>
                </div>
                <div>
                  <p className="text-lg font-semibold">{weekly.lastWeekCount}</p>
                  <p className="text-xs text-muted-foreground">Last Week</p>
                </div>
                <div>
                  <p className="text-lg font-semibold">{weekly.activeMembers}</p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </div>
              {weekly.lastWeekTotal > 0 && (
                <div className="text-xs text-muted-foreground">
                  Last week: ₱{weekly.lastWeekTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Loading…
            </p>
          )}
        </CardContent>
      </Card>

      {/* Calendar Heatmap */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              Payment Heatmap
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[100px] text-center">
                {MONTH_NAMES[heatmapMonth - 1]} {heatmapYear}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_LABELS.map((d) => (
              <div key={d} className="text-center text-[10px] text-muted-foreground font-medium">
                {d}
              </div>
            ))}
          </div>
          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell, i) =>
              cell ? (
                <div
                  key={cell.dateStr}
                  className={`aspect-square rounded-md flex items-center justify-center text-xs font-medium relative group ${heatColor(
                    heatmap.get(cell.dateStr) ?? 0
                  )}`}
                >
                  {cell.day}
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50">
                    <div className="rounded bg-popover border px-2 py-1 text-xs shadow-md whitespace-nowrap">
                      {heatmap.get(cell.dateStr) ?? 0}% paid
                    </div>
                  </div>
                </div>
              ) : (
                <div key={`empty-${i}`} />
              )
            )}
          </div>
          {/* Legend */}
          <div className="flex items-center justify-center gap-2 mt-3 text-xs text-muted-foreground">
            <span>Less</span>
            <div className="h-3 w-3 rounded-sm bg-muted" />
            <div className="h-3 w-3 rounded-sm bg-red-200" />
            <div className="h-3 w-3 rounded-sm bg-orange-200" />
            <div className="h-3 w-3 rounded-sm bg-yellow-200" />
            <div className="h-3 w-3 rounded-sm bg-green-300" />
            <span>More</span>
          </div>
          {totalMembers > 0 && (
            <p className="text-[10px] text-muted-foreground text-center mt-1">
              Based on {totalMembers} active member{totalMembers !== 1 && "s"}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
