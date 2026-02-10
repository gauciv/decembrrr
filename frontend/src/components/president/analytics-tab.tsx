import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/context/auth";
import {
  getWeeklyAnalytics,
  getMyClass,
  getNoClassDates,
  type ClassData,
  type NoClassDate,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
} from "lucide-react";
import { TabSkeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";

// --- Types ---

interface WeeklyData {
  thisWeekTotal: number;
  lastWeekTotal: number;
  thisWeekCount: number;
  lastWeekCount: number;
  activeMembers: number;
  weekStartDate: string;
}

type ViewMode = "weekly" | "monthly" | "overall";

// --- Helpers ---

/** Count collection days between two dates (inclusive) */
function countCollectionDays(
  from: Date,
  to: Date,
  collectionDays: number[],
  noClassSet: Set<string>,
): number {
  let count = 0;
  const cursor = new Date(from);
  while (cursor <= to) {
    const jsDay = cursor.getDay();
    const isoDay = jsDay === 0 ? 7 : jsDay;
    const dateStr = cursor.toISOString().slice(0, 10);
    if (collectionDays.includes(isoDay) && !noClassSet.has(dateStr)) {
      count++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/** Get Monday of the week containing a given date */
function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

// --- Simple Bar Chart ---

function BarChart({
  bars,
  maxValue,
}: {
  bars: Array<{ label: string; actual: number; expected: number }>;
  maxValue: number;
}) {
  const barWidth = 100 / Math.max(bars.length, 1);
  const safeMax = maxValue || 1;

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1 h-40">
        {bars.map((bar, i) => {
          const actualH = Math.max(2, (bar.actual / safeMax) * 100);
          const expectedH = Math.max(2, (bar.expected / safeMax) * 100);
          return (
            <div
              key={i}
              className="flex-1 flex items-end justify-center gap-0.5 h-full"
              style={{ maxWidth: `${barWidth}%` }}
            >
              <div
                className="w-2/5 rounded-t-sm bg-emerald-500 transition-all relative group"
                style={{ height: `${actualH}%` }}
              >
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50">
                  <div className="rounded bg-popover border px-1.5 py-0.5 text-[10px] shadow-md whitespace-nowrap">
                    ₱{bar.actual.toFixed(0)}
                  </div>
                </div>
              </div>
              <div
                className="w-2/5 rounded-t-sm bg-muted-foreground/20 transition-all relative group"
                style={{ height: `${expectedH}%` }}
              >
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50">
                  <div className="rounded bg-popover border px-1.5 py-0.5 text-[10px] shadow-md whitespace-nowrap">
                    ₱{bar.expected.toFixed(0)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-1">
        {bars.map((bar, i) => (
          <div
            key={i}
            className="flex-1 text-center text-[10px] text-muted-foreground truncate"
            style={{ maxWidth: `${barWidth}%` }}
          >
            {bar.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Main Component ---

export default function PresidentAnalyticsTab() {
  const { profile } = useAuth();
  const [weekly, setWeekly] = useState<WeeklyData | null>(null);
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [noClassDates, setNoClassDates] = useState<NoClassDate[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("weekly");
  const [initialLoading, setInitialLoading] = useState(true);

  // Daily deposit totals for graph
  const [dailyDeposits, setDailyDeposits] = useState<Map<string, number>>(new Map());

  const loadData = useCallback(async () => {
    if (!profile?.class_id) return;
    try {
      const [c, ncd, w] = await Promise.all([
        getMyClass(profile.class_id),
        getNoClassDates(profile.class_id),
        getWeeklyAnalytics(profile.class_id),
      ]);
      setClassData(c);
      setNoClassDates(ncd);
      setWeekly(w);

      // Get all deposit transactions grouped by day
      const { data: txns } = await supabase
        .from("transactions")
        .select("amount, created_at")
        .eq("class_id", profile.class_id)
        .eq("type", "deposit")
        .order("created_at");

      const map = new Map<string, number>();
      for (const t of (txns ?? []) as Array<{ amount: number; created_at: string }>) {
        const d = t.created_at.slice(0, 10);
        map.set(d, (map.get(d) ?? 0) + t.amount);
      }
      setDailyDeposits(map);
    } finally {
      setInitialLoading(false);
    }
  }, [profile?.class_id]);

  useEffect(() => { loadData(); }, [loadData]);

  const noClassSet = useMemo(() => new Set(noClassDates.map((d) => d.date)), [noClassDates]);

  // --- Graph Data Computation ---

  const graphData = useMemo(() => {
    if (!classData) return null;

    const initiated = new Date(classData.date_initiated + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const colDays = classData.collection_days ?? [1, 2, 3, 4, 5];
    const dailyAmt = classData.daily_amount;
    const activeMembers = weekly?.activeMembers ?? 1;

    if (viewMode === "weekly") {
      const thisMonday = getMonday(today);
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(lastMonday.getDate() - 7);

      const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const thisWeekBars = dayLabels.map((label, i) => {
        const date = new Date(thisMonday);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().slice(0, 10);
        const actual = dailyDeposits.get(dateStr) ?? 0;

        const jsDay = date.getDay();
        const isoDay = jsDay === 0 ? 7 : jsDay;
        const isCollDay = colDays.includes(isoDay) && !noClassSet.has(dateStr) && date >= initiated;
        const expected = isCollDay ? dailyAmt * activeMembers : 0;

        return { label, actual, expected };
      });

      const lastWeekBars = dayLabels.map((_label, i) => {
        const date = new Date(lastMonday);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().slice(0, 10);
        return dailyDeposits.get(dateStr) ?? 0;
      });

      const thisWeekActual = thisWeekBars.reduce((s, b) => s + b.actual, 0);
      const lastWeekActual = lastWeekBars.reduce((s, b) => s + b, 0);
      const thisWeekExpected = thisWeekBars.reduce((s, b) => s + b.expected, 0);

      return {
        bars: thisWeekBars,
        maxValue: Math.max(...thisWeekBars.map((b) => Math.max(b.actual, b.expected)), 1),
        summaryActual: thisWeekActual,
        summaryExpected: thisWeekExpected,
        comparisonLabel: "Last Week",
        comparisonValue: lastWeekActual,
      };
    }

    if (viewMode === "monthly") {
      const year = today.getFullYear();
      const month = today.getMonth();
      const firstOfMonth = new Date(year, month, 1);
      const lastOfMonth = new Date(year, month + 1, 0);

      const weeks: Array<{ label: string; actual: number; expected: number }> = [];
      let weekStart = new Date(firstOfMonth);
      let weekNum = 1;

      while (weekStart <= lastOfMonth) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const clampedEnd = weekEnd > lastOfMonth ? lastOfMonth : weekEnd;

        let actual = 0;
        let expected = 0;
        const cursor = new Date(weekStart);
        while (cursor <= clampedEnd) {
          const dateStr = cursor.toISOString().slice(0, 10);
          actual += dailyDeposits.get(dateStr) ?? 0;

          const jsDay = cursor.getDay();
          const isoDay = jsDay === 0 ? 7 : jsDay;
          if (colDays.includes(isoDay) && !noClassSet.has(dateStr) && cursor >= initiated) {
            expected += dailyAmt * activeMembers;
          }
          cursor.setDate(cursor.getDate() + 1);
        }

        weeks.push({ label: `W${weekNum}`, actual, expected });
        weekStart = new Date(clampedEnd);
        weekStart.setDate(weekStart.getDate() + 1);
        weekNum++;
      }

      const totalActual = weeks.reduce((s, w) => s + w.actual, 0);
      const totalExpected = weeks.reduce((s, w) => s + w.expected, 0);

      return {
        bars: weeks,
        maxValue: Math.max(...weeks.map((w) => Math.max(w.actual, w.expected)), 1),
        summaryActual: totalActual,
        summaryExpected: totalExpected,
        comparisonLabel: "Expected",
        comparisonValue: totalExpected,
      };
    }

    // Overall: since initiated — bars for each month
    const months: Array<{ label: string; actual: number; expected: number }> = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const cursorMonth = new Date(initiated.getFullYear(), initiated.getMonth(), 1);

    while (cursorMonth <= today) {
      const y = cursorMonth.getFullYear();
      const m = cursorMonth.getMonth();
      const monthStart = new Date(y, m, 1);
      const monthEnd = new Date(y, m + 1, 0);
      const clampedEnd = monthEnd > today ? today : monthEnd;
      const clampedStart = monthStart < initiated ? initiated : monthStart;

      let actual = 0;
      let expected = 0;
      const cursor = new Date(clampedStart);
      while (cursor <= clampedEnd) {
        const dateStr = cursor.toISOString().slice(0, 10);
        actual += dailyDeposits.get(dateStr) ?? 0;

        const jsDay = cursor.getDay();
        const isoDay = jsDay === 0 ? 7 : jsDay;
        if (colDays.includes(isoDay) && !noClassSet.has(dateStr)) {
          expected += dailyAmt * activeMembers;
        }
        cursor.setDate(cursor.getDate() + 1);
      }

      months.push({ label: monthNames[m], actual, expected });
      cursorMonth.setMonth(cursorMonth.getMonth() + 1);
    }

    const totalActual = months.reduce((s, m) => s + m.actual, 0);
    const totalExpected = months.reduce((s, m) => s + m.expected, 0);
    const totalCollectionDays = countCollectionDays(initiated, today, colDays, noClassSet);
    const perfectTotal = totalCollectionDays * dailyAmt * activeMembers;

    return {
      bars: months,
      maxValue: Math.max(...months.map((m) => Math.max(m.actual, m.expected)), 1),
      summaryActual: totalActual,
      summaryExpected: totalExpected,
      comparisonLabel: "Perfect Scenario",
      comparisonValue: perfectTotal,
    };
  }, [classData, weekly, dailyDeposits, noClassSet, viewMode]);

  if (!profile?.class_id) return null;
  if (initialLoading) return <TabSkeleton />;

  const wowChange =
    weekly && weekly.lastWeekTotal > 0
      ? ((weekly.thisWeekTotal - weekly.lastWeekTotal) / weekly.lastWeekTotal) * 100
      : null;

  const completionPct = graphData && graphData.summaryExpected > 0
    ? Math.round((graphData.summaryActual / graphData.summaryExpected) * 100)
    : 0;

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
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
          )}
        </CardContent>
      </Card>

      {/* Progress Comparison Graph */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" />
              Progress
            </CardTitle>
          </div>
          {/* View mode tabs */}
          <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5 mt-2">
            {(["weekly", "monthly", "overall"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  viewMode === mode
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode === "weekly" ? "This Week" : mode === "monthly" ? "This Month" : "Since Start"}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {graphData && (
            <div className="space-y-4">
              {/* Completion indicator */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">
                    ₱{graphData.summaryActual.toLocaleString("en-PH", { minimumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    of ₱{graphData.summaryExpected.toLocaleString("en-PH", { minimumFractionDigits: 0 })} expected
                  </p>
                </div>
                <div className={`text-right ${completionPct >= 80 ? "text-green-600" : completionPct >= 50 ? "text-amber-500" : "text-red-500"}`}>
                  <p className="text-2xl font-bold">{completionPct}%</p>
                  <p className="text-xs text-muted-foreground">completion</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2.5 rounded-full bg-muted">
                <div
                  className={`h-2.5 rounded-full transition-all ${
                    completionPct >= 80 ? "bg-green-500" : completionPct >= 50 ? "bg-amber-400" : "bg-red-400"
                  }`}
                  style={{ width: `${Math.min(100, completionPct)}%` }}
                />
              </div>

              {/* Bar chart */}
              <BarChart bars={graphData.bars} maxValue={graphData.maxValue} />

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                  <span>Actual</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-2.5 w-2.5 rounded-sm bg-muted-foreground/20" />
                  <span>Expected</span>
                </div>
              </div>

              {/* Comparison note */}
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-xs text-muted-foreground">
                  {viewMode === "weekly" && (
                    <>Last week: ₱{graphData.comparisonValue.toLocaleString("en-PH", { minimumFractionDigits: 0 })}</>
                  )}
                  {viewMode === "monthly" && (
                    <>Monthly expected: ₱{graphData.comparisonValue.toLocaleString("en-PH", { minimumFractionDigits: 0 })}</>
                  )}
                  {viewMode === "overall" && (
                    <>Perfect scenario (100% compliance): ₱{graphData.comparisonValue.toLocaleString("en-PH", { minimumFractionDigits: 0 })}</>
                  )}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
