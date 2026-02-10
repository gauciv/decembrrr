import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/context/auth";
import {
  getWalletSummary,
  getMyClass,
  getClassDeductionStatus,
  exportTransactionsCsv,
  getNoClassDates,
  getMonthlyHeatmap,
  rollbackNoClassDate,
  removeNoClassDate,
  type WalletSummary,
  type ClassData,
  type NoClassDate,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Wallet,
  Download,
  Users,
  Search,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { TabSkeleton } from "@/components/ui/skeleton";

// --- Helpers ---

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2);
}

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

// --- Types ---

interface MemberDeductionStatus {
  id: string;
  name: string;
  avatar_url: string | null;
  balance: number;
  deductedToday: boolean;
}

// --- Component ---

export default function PresidentWalletTab() {
  const { profile } = useAuth();
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [members, setMembers] = useState<MemberDeductionStatus[]>([]);
  const [noClassDates, setNoClassDates] = useState<NoClassDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [toast, setToast] = useState("");
  const [txnSearch, setTxnSearch] = useState("");

  // Calendar state
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

  const loadData = useCallback(async () => {
    if (!profile?.class_id) return;
    setLoading(true);
    try {
      const [w, c, statusData, ncd] = await Promise.all([
        getWalletSummary(profile.class_id),
        getMyClass(profile.class_id),
        getClassDeductionStatus(profile.class_id),
        getNoClassDates(profile.class_id),
      ]);
      setWallet(w);
      setClassData(c);
      setMembers(statusData);
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
  const noClassDateMap = useMemo(() => new Map(noClassDates.map((d) => [d.date, d])), [noClassDates]);
  const initiatedDate = classData ? new Date(classData.date_initiated + "T00:00:00") : null;
  const collectionDays = classData?.collection_days ?? [1, 2, 3, 4, 5];

  // Filtered transaction list (today's deductions/contributions)
  const filteredMembers = members.filter((m) =>
    m.name.toLowerCase().includes(txnSearch.toLowerCase())
  );
  const contributed = filteredMembers.filter((m) => m.deductedToday);
  const missed = filteredMembers.filter((m) => !m.deductedToday);

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
      await Promise.all([loadData(), loadHeatmap()]);
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
      await Promise.all([loadData(), loadHeatmap()]);
    } catch (err) {
      setToast(getErrorMessage(err));
      setTimeout(() => setToast(""), 4000);
    } finally {
      setDayLoading(false);
    }
  }

  async function handleDownload() {
    if (!profile?.class_id) return;
    setDownloading(true);
    try {
      await exportTransactionsCsv(profile.class_id);
      setToast("CSV downloaded successfully");
      setTimeout(() => setToast(""), 3000);
    } catch (err) {
      setToast(getErrorMessage(err));
      setTimeout(() => setToast(""), 4000);
    } finally {
      setDownloading(false);
    }
  }

  if (loading) return <TabSkeleton />;
  if (!wallet || !classData) return null;

  const goalProgress =
    classData.fund_goal && classData.fund_goal > 0
      ? Math.min(100, Math.round((wallet.totalBalance / classData.fund_goal) * 100))
      : null;

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
      {/* Toast */}
      {toast && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700 text-center">
          {toast}
        </div>
      )}

      {/* Class Fund Card */}
      <div className="rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 p-5 text-white">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 opacity-80" />
            <span className="text-sm font-medium opacity-80">Class Fund</span>
          </div>
          <div className="flex items-center gap-1 text-sm opacity-80">
            <Users className="h-3.5 w-3.5" />
            <span>{wallet.activeMembers}/{wallet.totalMembers}</span>
          </div>
        </div>
        <p className="text-3xl font-bold tracking-tight">
          ₱{wallet.totalBalance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
        </p>
        {goalProgress !== null && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="opacity-80">Goal Progress</span>
              <span className="font-medium">
                {goalProgress}% of ₱{classData.fund_goal!.toLocaleString()}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/20">
              <div
                className="h-2 rounded-full bg-white transition-all"
                style={{ width: `${goalProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Today's Activity List */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Today's Activity
          </CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search members…"
              value={txnSearch}
              onChange={(e) => setTxnSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="max-h-64 overflow-y-auto space-y-0.5">
            {/* Contributed */}
            {contributed.length > 0 && (
              <div className="space-y-0.5">
                {contributed.map((m) => (
                  <div key={m.id} className="flex items-center gap-2.5 rounded-lg p-2 hover:bg-muted/50">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={m.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px]">{initials(m.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.name}</p>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-green-600 font-medium shrink-0">
                      <CheckCircle2 className="h-3 w-3" />
                      Paid
                    </span>
                  </div>
                ))}
              </div>
            )}
            {/* Missed */}
            {missed.length > 0 && (
              <div className="space-y-0.5">
                {missed.map((m) => (
                  <div key={m.id} className="flex items-center gap-2.5 rounded-lg p-2 hover:bg-muted/50">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={m.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px]">{initials(m.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.name}</p>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-red-500 font-medium shrink-0">
                      <XCircle className="h-3 w-3" />
                      Missed
                    </span>
                  </div>
                ))}
              </div>
            )}
            {filteredMembers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No members found
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Download CSV */}
      <Button
        variant="outline"
        className="w-full"
        onClick={handleDownload}
        disabled={downloading}
      >
        <Download className="h-4 w-4 mr-2" />
        {downloading ? "Downloading…" : "Download Transactions CSV"}
      </Button>

      {/* Calendar Heatmap */}
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
                cellClass += "bg-gray-800 text-white cursor-pointer";
              } else if (isFuture) {
                cellClass += "border border-dashed border-muted-foreground/30 text-muted-foreground/60 cursor-pointer";
              } else {
                cellClass += heatColor(pct) + " cursor-pointer";
              }

              const clickable = !isBeforeInit && payDay;

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
                : selectedDate && new Date(selectedDate + "T00:00:00") > now
                  ? "This is an upcoming collection day"
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
                  {dayLoading ? "Removing…" : "Remove No-Class Mark"}
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
                    {selectedDate && new Date(selectedDate + "T00:00:00") > now
                      ? "Marking as no-class will prevent deductions on this day."
                      : "Marking as no-class will reverse any deductions made on this day and refund affected students."}
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={handleMarkNoClass}
                  disabled={dayLoading}
                >
                  {dayLoading ? "Processing…" : "Mark as No Class"}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
