import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/context/auth";
import {
  getMyClass,
  getNoClassDates,
  getStudentMonthlyCalendar,
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

function isPayDay(date: Date, collectionDays: number[], dateInitiated: Date): boolean {
  if (date < dateInitiated) return false;
  const jsDay = date.getDay();
  const isoDay = jsDay === 0 ? 7 : jsDay;
  return collectionDays.includes(isoDay);
}

/**
 * Student Calendar Tab — personal view of the student's payment calendar.
 * Green = paid that day, Red = missed, dark = no class.
 */
export default function StudentCalendarTab() {
  const { profile } = useAuth();
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [noClassDates, setNoClassDates] = useState<NoClassDate[]>([]);
  const [loading, setLoading] = useState(true);

  // Calendar state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [paidDates, setPaidDates] = useState<Set<string>>(new Set());

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

  const loadCalendar = useCallback(async () => {
    if (!profile?.id || !profile?.class_id) return;
    const dates = await getStudentMonthlyCalendar(
      profile.id,
      profile.class_id,
      calYear,
      calMonth
    );
    setPaidDates(dates);
  }, [profile?.id, profile?.class_id, calYear, calMonth]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadCalendar(); }, [loadCalendar]);

  const noClassDateSet = useMemo(() => new Set(noClassDates.map((d) => d.date)), [noClassDates]);
  const initiatedDate = classData ? new Date(classData.date_initiated + "T00:00:00") : null;
  const collectionDays = classData?.collection_days ?? [1, 2, 3, 4, 5];

  // Calendar navigation
  function prevMonth() {
    if (initiatedDate) {
      const initYear = initiatedDate.getFullYear();
      const initMonth = initiatedDate.getMonth() + 1;
      if (calYear === initYear && calMonth <= initMonth) return;
      if (calYear < initYear) return;
    }
    if (calMonth === 1) {
      setCalMonth(12);
      setCalYear((y) => y - 1);
    } else {
      setCalMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (calMonth === 12) {
      setCalMonth(1);
      setCalYear((y) => y + 1);
    } else {
      setCalMonth((m) => m + 1);
    }
  }

  if (loading) return <TabSkeleton />;
  if (!classData) return null;

  // Calendar grid
  const firstDay = new Date(calYear, calMonth - 1, 1);
  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const startDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

  const calendarCells: Array<{ day: number; dateStr: string } | null> = [];
  for (let i = 0; i < startDow; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    calendarCells.push({ day: d, dateStr });
  }

  const canGoPrev = initiatedDate
    ? calYear > initiatedDate.getFullYear() ||
      (calYear === initiatedDate.getFullYear() && calMonth > initiatedDate.getMonth() + 1)
    : true;

  // Count paid & missed for the summary
  let paidCount = 0;
  let missedCount = 0;
  for (const cell of calendarCells) {
    if (!cell) continue;
    const cellDate = new Date(calYear, calMonth - 1, cell.day);
    if (initiatedDate && cellDate < initiatedDate) continue;
    if (!isPayDay(cellDate, collectionDays, initiatedDate!)) continue;
    if (noClassDateSet.has(cell.dateStr)) continue;
    if (cellDate > now) continue;
    if (paidDates.has(cell.dateStr)) paidCount++;
    else missedCount++;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              My Calendar
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
                {MONTH_NAMES[calMonth - 1]} {calYear}
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

              const cellDate = new Date(calYear, calMonth - 1, cell.day);
              const isNoClass = noClassDateSet.has(cell.dateStr);
              const payDay = initiatedDate ? isPayDay(cellDate, collectionDays, initiatedDate) : false;
              const isFuture = cellDate > now;
              const isBeforeInit = initiatedDate ? cellDate < initiatedDate : false;
              const paid = paidDates.has(cell.dateStr);

              let cellClass = "aspect-square rounded-md flex items-center justify-center text-xs font-medium relative group cursor-default ";
              if (isBeforeInit || !payDay) {
                cellClass += "bg-muted/40 text-muted-foreground/40";
              } else if (isNoClass) {
                cellClass += "bg-gray-800 text-white";
              } else if (isFuture) {
                cellClass += "border border-dashed border-muted-foreground/30 text-muted-foreground/60";
              } else if (paid) {
                cellClass += "bg-green-400 text-green-900";
              } else {
                cellClass += "bg-red-300 text-red-900";
              }

              const showTooltip = !isBeforeInit && payDay;

              return (
                <div key={cell.dateStr} className={cellClass}>
                  {cell.day}
                  {showTooltip && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50">
                      <div className="rounded bg-popover border px-2 py-1 text-xs shadow-md whitespace-nowrap text-foreground">
                        {isNoClass ? "No class" : isFuture ? "Upcoming" : paid ? "Paid ✓" : "Missed ✗"}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex items-center justify-center gap-2 mt-3 text-xs text-muted-foreground flex-wrap">
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-sm bg-green-400" />
              <span>Paid</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-sm bg-red-300" />
              <span>Missed</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-sm bg-gray-800" />
              <span>No class</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-sm border border-dashed border-muted-foreground/30" />
              <span>Upcoming</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-sm bg-muted/40" />
              <span>Off</span>
            </div>
          </div>
          {/* Monthly summary */}
          <div className="flex items-center justify-center gap-4 mt-2 text-xs font-medium">
            <span className="text-green-600">{paidCount} paid</span>
            <span className="text-red-500">{missedCount} missed</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
