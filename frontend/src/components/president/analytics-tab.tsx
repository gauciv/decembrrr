import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/auth";
import {
  getWeeklyAnalytics,
  getMonthlyHeatmap,
  getMyClass,
  getNoClassDates,
  removeNoClassDate,
  rollbackNoClassDate,
  type ClassData,
  type NoClassDate,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { TabSkeleton } from "@/components/ui/skeleton";

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

/** Color coding: red 0-15%, orange 16-65%, green 66-100% */
function heatColor(pct: number): string {
  if (pct <= 15) return "bg-red-300 text-red-900";
  if (pct <= 65) return "bg-orange-300 text-orange-900";
  return "bg-green-400 text-green-900";
}

/** Check if a date is a valid collection day */
function isPayDay(
  date: Date,
  collectionDays: number[],
  dateInitiated: Date,
): boolean {
  if (date < dateInitiated) return false;
  const jsDay = date.getDay();
  const isoDay = jsDay === 0 ? 7 : jsDay;
  return collectionDays.includes(isoDay);
}

export default function PresidentAnalyticsTab() {
  const { profile } = useAuth();
  const [weekly, setWeekly] = useState<WeeklyData | null>(null);
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [noClassDates, setNoClassDates] = useState<NoClassDate[]>([]);

  const now = new Date();
  const [heatmapYear, setHeatmapYear] = useState(now.getFullYear());
  const [heatmapMonth, setHeatmapMonth] = useState(now.getMonth() + 1);
  const [heatmap, setHeatmap] = useState<Map<string, number>>(new Map());
  const [totalMembers, setTotalMembers] = useState(0);

  // Day modal
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedPct, setSelectedPct] = useState(0);
  const [reason, setReason] = useState("");
  const [dayLoading, setDayLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);

  const loadClass = useCallback(async () => {
    if (!profile?.class_id) return;
    try {
      const [c, ncd] = await Promise.all([
        getMyClass(profile.class_id),
        getNoClassDates(profile.class_id),
      ]);
      setClassData(c);
      setNoClassDates(ncd);
    } finally {
      setInitialLoading(false);
    }
  }, [profile?.class_id]);

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

  useEffect(() => { loadClass(); }, [loadClass]);
  useEffect(() => { loadWeekly(); }, [loadWeekly]);
  useEffect(() => { loadHeatmap(); }, [loadHeatmap]);

  const noClassDateSet = new Set(noClassDates.map((d) => d.date));
  const noClassDateMap = new Map(noClassDates.map((d) => [d.date, d]));
  const initiatedDate = classData ? new Date(classData.date_initiated + "T00:00:00") : null;
  const collectionDays = classData?.collection_days ?? [1, 2, 3, 4, 5];

  function prevMonth() {
    if (initiatedDate) {
      const initYear = initiatedDate.getFullYear();
      const initMonth = initiatedDate.getMonth() + 1;
      if (heatmapYear === initYear && heatmapMonth <= initMonth) return;
      if (heatmapYear < initYear) return;
    }
    if (heatmapMonth === 1) {
      setHeatmapMonth(12);
      setHeatmapYear((y) => y - 1);
    } else {
      setHeatmapMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth() + 1;
    if (heatmapYear === nowYear && heatmapMonth >= nowMonth) return;
    if (heatmapMonth === 12) {
      setHeatmapMonth(1);
      setHeatmapYear((y) => y + 1);
    } else {
      setHeatmapMonth((m) => m + 1);
    }
  }

  function handleDayClick(dateStr: string, pct: number) {
    setSelectedDate(dateStr);
    setSelectedPct(pct);
    setReason("");
  }

  async function handleMarkNoClass() {
    if (!selectedDate || !profile?.class_id) return;
    setDayLoading(true);
    try {
      const result = await rollbackNoClassDate(profile.class_id, selectedDate);
      const msg = result.rolled_back > 0
        ? `Marked as no-class and reversed ${result.rolled_back} deduction(s)`
        : "Marked as no-class";
      setToast(msg);
      setTimeout(() => setToast(""), 4000);
      setSelectedDate(null);
      await Promise.all([loadClass(), loadHeatmap()]);
    } catch (err) {
      setToast(getErrorMessage(err));
      setTimeout(() => setToast(""), 4000);
    } finally {
      setDayLoading(false);
    }
  }

  async function handleUnmarkNoClass() {
    if (!selectedDate) return;
    const ncd = noClassDateMap.get(selectedDate);
    if (!ncd) return;
    setDayLoading(true);
    try {
      await removeNoClassDate(ncd.id);
      setToast("Removed no-class mark");
      setTimeout(() => setToast(""), 3000);
      setSelectedDate(null);
      await Promise.all([loadClass(), loadHeatmap()]);
    } catch (err) {
      setToast(getErrorMessage(err));
      setTimeout(() => setToast(""), 4000);
    } finally {
      setDayLoading(false);
    }
  }

  if (!profile?.class_id) return null;
  if (initialLoading) return <TabSkeleton />;

  const wowChange =
    weekly && weekly.lastWeekTotal > 0
      ? ((weekly.thisWeekTotal - weekly.lastWeekTotal) / weekly.lastWeekTotal) * 100
      : null;

  // Build calendar grid
  const firstDay = new Date(heatmapYear, heatmapMonth - 1, 1);
  const daysInMonth = new Date(heatmapYear, heatmapMonth, 0).getDate();
  const startDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

  const calendarCells: Array<{ day: number; dateStr: string } | null> = [];
  for (let i = 0; i < startDow; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${heatmapYear}-${String(heatmapMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    calendarCells.push({ day: d, dateStr });
  }

  const canGoPrev = initiatedDate
    ? heatmapYear > initiatedDate.getFullYear() ||
      (heatmapYear === initiatedDate.getFullYear() && heatmapMonth > initiatedDate.getMonth() + 1)
    : true;
  const canGoNext = heatmapYear < now.getFullYear() ||
    (heatmapYear === now.getFullYear() && heatmapMonth < now.getMonth() + 1);

  return (
    <div className="space-y-4">
      {toast && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700 text-center">
          {toast}
        </div>
      )}

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
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
          )}
        </CardContent>
      </Card>

      {/* Calendar */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              Calendar
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={prevMonth}
                disabled={!canGoPrev}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[100px] text-center">
                {MONTH_NAMES[heatmapMonth - 1]} {heatmapYear}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={nextMonth}
                disabled={!canGoNext}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_LABELS.map((d) => (
              <div key={d} className="text-center text-[10px] text-muted-foreground font-medium">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell, i) => {
              if (!cell) return <div key={`empty-${i}`} />;

              const cellDate = new Date(heatmapYear, heatmapMonth - 1, cell.day);
              const isNoClass = noClassDateSet.has(cell.dateStr);
              const payDay = initiatedDate ? isPayDay(cellDate, collectionDays, initiatedDate) : false;
              const isFuture = cellDate > now;
              const isBeforeInit = initiatedDate ? cellDate < initiatedDate : false;
              const pct = heatmap.get(cell.dateStr) ?? 0;

              let cellClass = "aspect-square rounded-md flex items-center justify-center text-xs font-medium relative group cursor-default ";
              if (isBeforeInit || !payDay) {
                // Not a collection day or before class started — fully muted
                cellClass += "bg-muted/40 text-muted-foreground/40";
              } else if (isFuture) {
                // Future pay day — outlined but not colored yet
                cellClass += "border border-dashed border-muted-foreground/30 text-muted-foreground/60";
              } else if (isNoClass) {
                cellClass += "bg-gray-800 text-white cursor-pointer";
              } else {
                cellClass += heatColor(pct) + " cursor-pointer";
              }

              const clickable = !isBeforeInit && payDay && !isFuture;

              return (
                <div
                  key={cell.dateStr}
                  className={cellClass}
                  onClick={clickable ? () => handleDayClick(cell.dateStr, pct) : undefined}
                >
                  {cell.day}
                  {clickable && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50">
                      <div className="rounded bg-popover border px-2 py-1 text-xs shadow-md whitespace-nowrap text-foreground">
                        {isNoClass ? "No class" : `${pct}% paid`}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-2 mt-3 text-xs text-muted-foreground flex-wrap">
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-sm bg-muted/40" />
              <span>Off</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-sm border border-dashed border-muted-foreground/30" />
              <span>Upcoming</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-sm bg-red-300" />
              <span>0-15%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-sm bg-orange-300" />
              <span>16-65%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-sm bg-green-400" />
              <span>66-100%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-sm bg-gray-800" />
              <span>No class</span>
            </div>
          </div>
          {totalMembers > 0 && (
            <p className="text-[10px] text-muted-foreground text-center mt-1">
              Based on {totalMembers} active member{totalMembers !== 1 && "s"}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Day Modal */}
      <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedDate && new Date(selectedDate + "T00:00:00").toLocaleDateString("en-PH", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </DialogTitle>
            <DialogDescription>
              {selectedDate && noClassDateSet.has(selectedDate)
                ? "This day is marked as no class"
                : `${selectedPct}% of members paid on this day`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {selectedDate && noClassDateSet.has(selectedDate) ? (
              <>
                <div className="rounded-lg bg-gray-100 border p-3">
                  <p className="text-sm">
                    <span className="font-medium">Reason:</span>{" "}
                    {noClassDateMap.get(selectedDate)?.reason ?? "No class"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleUnmarkNoClass}
                  disabled={dayLoading}
                >
                  {dayLoading ? "Removing\u2026" : "Remove No-Class Mark"}
                </Button>
              </>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium">Reason (optional)</label>
                  <Input
                    placeholder="e.g. Holiday, Typhoon"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <p className="text-xs text-amber-700">
                    Marking as no-class will reverse any deductions made on this day
                    and refund affected students.
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={handleMarkNoClass}
                  disabled={dayLoading}
                >
                  {dayLoading ? "Processing\u2026" : "Mark as No Class"}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
