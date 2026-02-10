import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/context/auth";
import {
  getMyClass,
  getNoClassDates,
  getMonthlyHeatmap,
  type ClassData,
  type NoClassDate,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import { TabSkeleton } from "@/components/ui/skeleton";

// --- Helpers ---

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function heatColor(pct: number): string {
  if (pct <= 15) return "bg-red-300 text-red-900";
  if (pct <= 65) return "bg-orange-300 text-orange-900";
  return "bg-green-400 text-green-900";
}

function isPayDay(date: Date, collectionDays: number[], dateInitiated: Date): boolean {
  if (date < dateInitiated) return false;
  const jsDay = date.getDay();
  const isoDay = jsDay === 0 ? 7 : jsDay;
  return collectionDays.includes(isoDay);
}

/**
 * Student Calendar Tab — read-only view of the class heatmap calendar.
 * Shows collection days, no-class days, and daily payment percentages.
 */
export default function StudentCalendarTab() {
  const { profile } = useAuth();
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [noClassDates, setNoClassDates] = useState<NoClassDate[]>([]);
  const [loading, setLoading] = useState(true);

  // Calendar state
  const now = new Date();
  const [heatmapYear, setHeatmapYear] = useState(now.getFullYear());
  const [heatmapMonth, setHeatmapMonth] = useState(now.getMonth() + 1);
  const [heatmap, setHeatmap] = useState<Map<string, number>>(new Map());
  const [totalMembers, setTotalMembers] = useState(0);

  const loadData = useCallback(async () => {
    if (!profile?.class_id) return;
    setLoading(true);
    try {
      const [c, ncd] = await Promise.all([
        getMyClass(profile.class_id),
        getNoClassDates(profile.class_id),
      ]);
      setClassData(c);
      setNoClassDates(ncd);
    } finally {
      setLoading(false);
    }
  }, [profile?.class_id]);

  const loadHeatmap = useCallback(async () => {
    if (!profile?.class_id) return;
    const data = await getMonthlyHeatmap(profile.class_id, heatmapYear, heatmapMonth);
    setHeatmap(data.heatmap);
    setTotalMembers(data.totalMembers);
  }, [profile?.class_id, heatmapYear, heatmapMonth]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadHeatmap(); }, [loadHeatmap]);

  const noClassDateSet = useMemo(() => new Set(noClassDates.map((d) => d.date)), [noClassDates]);
  const initiatedDate = classData ? new Date(classData.date_initiated + "T00:00:00") : null;
  const collectionDays = classData?.collection_days ?? [1, 2, 3, 4, 5];

  // Calendar navigation
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
    if (heatmapMonth === 12) {
      setHeatmapMonth(1);
      setHeatmapYear((y) => y + 1);
    } else {
      setHeatmapMonth((m) => m + 1);
    }
  }

  if (loading) return <TabSkeleton />;
  if (!classData) return null;

  // Calendar grid
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

  return (
    <div className="space-y-4">
      {/* Calendar Heatmap */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              Class Calendar
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
                cellClass += "bg-muted/40 text-muted-foreground/40";
              } else if (isNoClass) {
                cellClass += "bg-gray-800 text-white";
              } else if (isFuture) {
                cellClass += "border border-dashed border-muted-foreground/30 text-muted-foreground/60";
              } else {
                cellClass += heatColor(pct);
              }

              const showTooltip = !isBeforeInit && payDay;

              return (
                <div key={cell.dateStr} className={cellClass}>
                  {cell.day}
                  {showTooltip && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50">
                      <div className="rounded bg-popover border px-2 py-1 text-xs shadow-md whitespace-nowrap text-foreground">
                        {isNoClass ? "No class" : isFuture ? "Upcoming" : `${pct}% paid`}
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
    </div>
  );
}
