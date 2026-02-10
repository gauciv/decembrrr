import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/context/auth";
import {
  getClassMembers,
  getMyClass,
  recordDeposit,
  getMyTransactions,
  getStudentPaymentStats,
  buildStudentEmailUri,
  updateClass,
  deleteClass,
  removeStudentFromClass,
  getNoClassDates,
  getMonthlyHeatmap,
  rollbackNoClassDate,
  removeNoClassDate,
  type Transaction,
  type ClassData,
  type UpdateClassInput,
  type NoClassDate,
} from "@/lib/api";
import type { Profile } from "@/context/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Plus,
  UserPlus,
  Copy,
  TrendingUp,
  TrendingDown,
  Mail,
  X,
  Pencil,
  Check,
  Trash2,
  ChevronLeft,
  ChevronRight,
  UserMinus,
  CalendarDays,
} from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { TabSkeleton } from "@/components/ui/skeleton";
import { useAutoRefresh } from "@/lib/use-auto-refresh";

// --- Calendar Helpers ---

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

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
}

export default function PresidentClassTab() {
  const { profile, refreshProfile } = useAuth();
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");

  // Deposit dialog
  const [depositTarget, setDepositTarget] = useState<Profile | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [depositing, setDepositing] = useState(false);
  const [toast, setToast] = useState("");

  // Student log dialog
  const [logStudent, setLogStudent] = useState<Profile | null>(null);
  const [logTxns, setLogTxns] = useState<Transaction[]>([]);
  const [logPage, setLogPage] = useState(0);
  const LOG_PER_PAGE = 5;

  // Invite dialog
  const [showInvite, setShowInvite] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [qrCopied, setQrCopied] = useState(false);

  // Edit dialog
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDaily, setEditDaily] = useState("");
  const [editGoal, setEditGoal] = useState("");
  const [editDateInitiated, setEditDateInitiated] = useState("");
  const [editCollectionDays, setEditCollectionDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Email
  const [emailLoading, setEmailLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Remove student
  const [removeTarget, setRemoveTarget] = useState<Profile | null>(null);
  const [removing, setRemoving] = useState(false);

  // Calendar modal
  const [showCalendar, setShowCalendar] = useState(false);
  const [noClassDates, setNoClassDates] = useState<NoClassDate[]>([]);
  const now = new Date();
  const [heatmapYear, setHeatmapYear] = useState(now.getFullYear());
  const [heatmapMonth, setHeatmapMonth] = useState(now.getMonth() + 1);
  const [heatmap, setHeatmap] = useState<Map<string, number>>(new Map());
  const [totalMembers, setTotalMembers] = useState(0);

  // Day modal (inside calendar)
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedPct, setSelectedPct] = useState(0);
  const [reason, setReason] = useState("");
  const [dayLoading, setDayLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!profile?.class_id) return;
    try {
      const [membersData, classInfo, ncd] = await Promise.all([
        getClassMembers(profile.class_id),
        getMyClass(profile.class_id),
        getNoClassDates(profile.class_id),
      ]);
      setMembers(membersData.sort((a, b) => a.name.localeCompare(b.name)));
      setClassData(classInfo);
      setNoClassDates(ncd);
    } finally {
      setInitialLoading(false);
    }
  }, [profile?.class_id]);

  const loadHeatmap = useCallback(async () => {
    if (!profile?.class_id) return;
    const data = await getMonthlyHeatmap(profile.class_id, heatmapYear, heatmapMonth);
    setHeatmap(data.heatmap);
    setTotalMembers(data.totalMembers);
  }, [profile?.class_id, heatmapYear, heatmapMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadHeatmap();
  }, [loadHeatmap]);

  useAutoRefresh(loadData);

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
  );

  // Calendar computed values
  const noClassDateSet = useMemo(() => new Set(noClassDates.map((d) => d.date)), [noClassDates]);
  const noClassDateMap = useMemo(() => new Map(noClassDates.map((d) => [d.date, d])), [noClassDates]);
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

      const optimisticEntry: NoClassDate = { id: crypto.randomUUID() as string, class_id: profile.class_id!, date: selectedDate, reason: reason || "", created_at: new Date().toISOString() };
      setNoClassDates((prev) => [...prev, optimisticEntry]);
      setHeatmap((prev) => {
        const next = new Map(prev);
        next.set(selectedDate, 0);
        return next;
      });
      setSelectedDate(null);

      loadData().catch(() => {});
      loadHeatmap().catch(() => {});
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

      setNoClassDates((prev) => prev.filter((d) => d.id !== ncd.id));
      setSelectedDate(null);

      loadData().catch(() => {});
      loadHeatmap().catch(() => {});
    } catch (err) {
      setToast(getErrorMessage(err));
      setTimeout(() => setToast(""), 4000);
    } finally {
      setDayLoading(false);
    }
  }

  async function handleDeposit() {
    if (!depositTarget || !amount || !profile?.class_id) return;
    setDepositing(true);
    try {
      await recordDeposit(
        depositTarget.id,
        profile.class_id,
        parseFloat(amount),
        note || undefined
      );
      setToast(`₱${amount} recorded for ${depositTarget.name}`);
      setDepositTarget(null);
      setAmount("");
      setNote("");
      await loadData();
      await refreshProfile();
      setTimeout(() => setToast(""), 3000);
    } catch (err) {
      setToast(getErrorMessage(err));
      setTimeout(() => setToast(""), 4000);
    } finally {
      setDepositing(false);
    }
  }

  async function openStudentLog(student: Profile) {
    setLogStudent(student);
    setLogPage(0);
    const txns = await getMyTransactions(student.id, 30);
    setLogTxns(txns);
  }

  function copyInviteCode() {
    if (!classData?.invite_code) return;
    navigator.clipboard.writeText(classData.invite_code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  async function copyQrImage() {
    if (!classData?.invite_code) return;
    const joinUrl = `${window.location.origin}/join?code=${classData.invite_code}`;
    try {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(joinUrl)}`;
      // Use ClipboardItem with a Promise-based blob to maintain user activation
      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": fetch(qrUrl).then((r) => r.blob()),
        }),
      ]);
      setQrCopied(true);
      setTimeout(() => setQrCopied(false), 2000);
    } catch {
      // Fallback: copy URL as text
      try {
        await navigator.clipboard.writeText(joinUrl);
      } catch {
        // Last resort: use deprecated execCommand
        const ta = document.createElement("textarea");
        ta.value = joinUrl;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setQrCopied(true);
      setTimeout(() => setQrCopied(false), 2000);
    }
  }

  function openEdit() {
    if (!classData) return;
    setEditName(classData.name);
    setEditDaily(String(classData.daily_amount));
    setEditGoal(classData.fund_goal ? String(classData.fund_goal) : "");
    setEditDateInitiated(classData.date_initiated ?? "");
    setEditCollectionDays(classData.collection_days ?? [1, 2, 3, 4, 5]);
    setShowEdit(true);
  }

  async function handleSaveEdit() {
    if (!classData || !profile?.class_id) return;
    setSaving(true);
    try {
      const input: UpdateClassInput = {};
      if (editName.trim() && editName.trim() !== classData.name) input.name = editName.trim();
      if (editDaily && parseFloat(editDaily) !== classData.daily_amount) input.dailyAmount = parseFloat(editDaily);
      const goalVal = editGoal ? parseFloat(editGoal) : null;
      if (goalVal !== classData.fund_goal) input.fundGoal = goalVal;
      if (editDateInitiated && editDateInitiated !== classData.date_initiated) input.dateInitiated = editDateInitiated;
      const prevDays = classData.collection_days ?? [1, 2, 3, 4, 5];
      if (JSON.stringify([...editCollectionDays].sort()) !== JSON.stringify([...prevDays].sort())) input.collectionDays = editCollectionDays;

      if (Object.keys(input).length > 0) {
        await updateClass(profile.class_id, input);
        await loadData();
        setToast("Class updated");
        setTimeout(() => setToast(""), 3000);
      }
      setShowEdit(false);
    } catch (err) {
      setToast(getErrorMessage(err));
      setTimeout(() => setToast(""), 4000);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteClass() {
    if (!classData || !profile?.class_id) return;
    if (deleteConfirmName.trim() !== classData.name) return;
    setDeleting(true);
    try {
      await deleteClass(profile.class_id);
      await refreshProfile();
      window.location.href = "/";
    } catch (err) {
      setToast(getErrorMessage(err));
      setTimeout(() => setToast(""), 4000);
      setDeleting(false);
    }
  }

  async function sendStudentEmail(student: Profile) {
    if (!profile?.class_id || !classData) return;
    setEmailLoading(true);
    try {
      const stats = await getStudentPaymentStats(student.id, profile.class_id);
      const uri = buildStudentEmailUri(stats, classData.name);
      window.open(uri, "_blank");
    } catch (err) {
      setToast(getErrorMessage(err));
      setTimeout(() => setToast(""), 4000);
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleRemoveStudent() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await removeStudentFromClass(removeTarget.id);
      setToast(`${removeTarget.name} removed from class`);
      setRemoveTarget(null);
      setLogStudent(null);
      await loadData();
      setTimeout(() => setToast(""), 3000);
    } catch (err) {
      setToast(getErrorMessage(err));
      setTimeout(() => setToast(""), 4000);
    } finally {
      setRemoving(false);
    }
  }

  if (!profile?.class_id) return null;
  if (initialLoading) return <TabSkeleton />;

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700 text-center">
          {toast}
        </div>
      )}

      {/* Class Details Card */}
      {classData && (
        <div className="rounded-xl border bg-gradient-to-br from-slate-50 to-white p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold">{classData.name}</h2>
              <p className="text-sm text-muted-foreground">
                ₱{classData.daily_amount}/
                {classData.collection_frequency === "weekly" ? "week" : "day"}
                {classData.fund_goal && (
                  <> · Goal: ₱{classData.fund_goal.toLocaleString("en-PH")}</>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Since {new Date(classData.date_initiated + "T00:00:00").toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
            <Badge variant="secondary" className="text-xs">
              {members.length} members
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground font-mono tracking-wider">
            Code: {classData.invite_code}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={openEdit}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowInvite(true)}>
              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
              Invite
            </Button>
          </div>
        </div>
      )}

      {/* Calendar Button */}
      <Button
        variant="outline"
        className="w-full"
        onClick={() => setShowCalendar(true)}
      >
        <CalendarDays className="h-4 w-4 mr-2" />
        Collection Calendar
      </Button>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search students…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Student List */}
      <div className="space-y-1">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No students found
          </p>
        ) : (
          filtered.map((member) => {
            const isMe = member.id === profile.id;
            return (
            <div
              key={member.id}
              className={`flex items-center gap-3 rounded-lg border p-3 ${isMe ? "bg-primary/5 border-primary/20" : ""}`}
            >
              {/* Clickable area for student log */}
              <button
                onClick={() => openStudentLog(member)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={member.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {initials(member.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {member.name}
                    {isMe && (
                      <Badge variant="outline" className="ml-1.5 text-[10px] px-1.5 py-0 align-middle border-primary/30 text-primary">
                        You · President
                      </Badge>
                    )}
                  </p>
                  <p
                    className={`text-sm font-semibold ${
                      member.balance <= 0
                        ? "text-red-600"
                        : member.balance < 50
                          ? "text-amber-500"
                          : "text-green-600"
                    }`}
                  >
                    {member.balance <= 0 ? (
                      <TrendingDown className="inline h-3 w-3 mr-0.5" />
                    ) : (
                      <TrendingUp className="inline h-3 w-3 mr-0.5" />
                    )}
                    ₱{Math.max(0, member.balance).toFixed(2)}
                  </p>
                </div>
              </button>
              {/* Add balance button */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDepositTarget(member)}
                className="shrink-0"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            </div>
          );})
        )}
      </div>

      {/* Deposit Dialog */}
      <Dialog
        open={!!depositTarget}
        onOpenChange={() => setDepositTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Balance</DialogTitle>
            <DialogDescription>
              {depositTarget && (
                <span className="flex items-center gap-2 mt-1">
                  <Avatar className="h-6 w-6">
                    <AvatarImage
                      src={depositTarget.avatar_url || undefined}
                    />
                    <AvatarFallback className="text-xs">
                      {initials(depositTarget.name)}
                    </AvatarFallback>
                  </Avatar>
                  {depositTarget.name} · Balance: ₱
                  {depositTarget.balance.toFixed(2)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium">Amount (₱)</label>
              <Input
                type="number"
                placeholder="e.g. 50"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="1"
                step="1"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              {[10, 50, 100, 200].map((preset) => (
                <Button
                  key={preset}
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(String(preset))}
                  className="flex-1"
                >
                  ₱{preset}
                </Button>
              ))}
            </div>
            <div>
              <label className="text-sm font-medium">Note (optional)</label>
              <Input
                placeholder="e.g. Week 3 payment"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleDeposit}
              disabled={depositing || !amount || parseFloat(amount) <= 0}
            >
              {depositing ? "Recording…" : `Confirm ₱${amount || "0"}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Student Log Dialog */}
      <Dialog open={!!logStudent} onOpenChange={() => setLogStudent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {logStudent && (
                <>
                  <Avatar className="h-7 w-7">
                    <AvatarImage
                      src={logStudent.avatar_url || undefined}
                    />
                    <AvatarFallback className="text-xs">
                      {initials(logStudent.name)}
                    </AvatarFallback>
                  </Avatar>
                  {logStudent.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription>Transaction history</DialogDescription>
          </DialogHeader>

          {/* Email Button */}
          {logStudent && (
            <div className="pt-2 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={emailLoading}
                onClick={() => sendStudentEmail(logStudent)}
              >
                <Mail className="h-4 w-4 mr-1.5" />
                {emailLoading ? "Preparing…" : "Email Summary"}
              </Button>
              {logStudent.id !== profile?.id && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setRemoveTarget(logStudent)}
                >
                  <UserMinus className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          <div className="min-h-[260px] space-y-1 pt-2">
            {logTxns.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No transactions yet
              </p>
            ) : (
              (() => {
                const logTotalPages = Math.max(1, Math.ceil(logTxns.length / LOG_PER_PAGE));
                const paginatedTxns = logTxns.slice(logPage * LOG_PER_PAGE, (logPage + 1) * LOG_PER_PAGE);
                return (
                  <>
                    {paginatedTxns.map((txn, i) => (
                      <div key={txn.id}>
                        {i > 0 && <Separator className="my-2" />}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm">{txn.note || txn.type}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(txn.created_at).toLocaleDateString("en-PH", {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <Badge
                            variant={
                              txn.type === "deposit" ? "default" : "secondary"
                            }
                            className={
                              txn.type === "deposit"
                                ? "bg-green-600"
                                : "bg-red-100 text-red-700"
                            }
                          >
                            {txn.type === "deposit" ? "+" : "-"}₱
                            {txn.amount.toFixed(2)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {logTotalPages > 1 && (
                      <div className="flex items-center justify-between pt-2 border-t mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setLogPage((p) => Math.max(0, p - 1))}
                          disabled={logPage === 0}
                          className="h-7 text-xs"
                        >
                          <ChevronLeft className="h-3.5 w-3.5 mr-0.5" /> Prev
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          {logPage + 1} / {logTotalPages}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setLogPage((p) => Math.min(logTotalPages - 1, p + 1))}
                          disabled={logPage >= logTotalPages - 1}
                          className="h-7 text-xs"
                        >
                          Next <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                        </Button>
                      </div>
                    )}
                  </>
                );
              })()
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Student Confirmation Dialog */}
      <Dialog open={!!removeTarget} onOpenChange={() => setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <UserMinus className="h-5 w-5" />
              Remove Student
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <span className="font-semibold">{removeTarget?.name}</span> from the class? Their balance will be reset to ₱0.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-xs text-red-700">
                This student will be removed from the class and will need to rejoin using the invite code. Their transaction history will be preserved.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setRemoveTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={removing}
                onClick={handleRemoveStudent}
              >
                {removing ? "Removing…" : "Remove Student"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invite Students
            </DialogTitle>
            <DialogDescription>
              Share the invite code or QR with your classmates
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {classData && (
              <>
                {/* QR Code */}
                <div className="flex flex-col items-center">
                  <button onClick={copyQrImage} className="relative group cursor-pointer">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(
                        `${window.location.origin}/join?code=${classData.invite_code}`
                      )}`}
                      alt="QR code to join class"
                      className="h-48 w-48 rounded-lg border-2 border-dashed border-muted-foreground/20 p-2"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white text-sm font-medium flex items-center gap-1">
                        {qrCopied ? (<><Check className="h-4 w-4" /> Copied!</>) : (<><Copy className="h-4 w-4" /> Copy QR</>)}
                      </span>
                    </div>
                  </button>
                  {qrCopied && (
                    <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
                      <Check className="h-3 w-3" /> QR code copied!
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Tap QR to copy · Students scan to join
                  </p>
                </div>

                <Separator />

                {/* Invite code */}
                <button
                  onClick={copyInviteCode}
                  className="flex w-full items-center justify-between rounded-lg border-2 border-dashed p-4 hover:bg-muted/50 transition-colors"
                >
                  <span className="font-mono text-2xl tracking-widest font-bold">
                    {classData.invite_code}
                  </span>
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    {codeCopied ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <Check className="h-4 w-4" /> Copied!
                      </span>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" /> Copy
                      </>
                    )}
                  </span>
                </button>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowInvite(false)}
                >
                  <X className="h-4 w-4 mr-1" />
                  Close
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Class Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit Class
            </DialogTitle>
            <DialogDescription>Update your class settings</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium">Class Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="e.g. Section A" />
            </div>
            <div>
              <label className="text-sm font-medium">Daily Amount (₱)</label>
              <Input type="number" value={editDaily} onChange={(e) => setEditDaily(e.target.value)} placeholder="e.g. 10" min="1" />
            </div>
            <div>
              <label className="text-sm font-medium">Fund Goal (₱)</label>
              <Input type="number" value={editGoal} onChange={(e) => setEditGoal(e.target.value)} placeholder="Leave empty for no goal" min="0" />
              <p className="text-xs text-muted-foreground mt-1">Leave empty for no target goal</p>
            </div>
            <div>
              <label className="text-sm font-medium">Date Initiated</label>
              <Input type="date" value={editDateInitiated} onChange={(e) => setEditDateInitiated(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">When the class fund started collecting</p>
            </div>
            <div>
              <label className="text-sm font-medium">Collection Days</label>
              <div className="flex gap-1.5 mt-1.5">
                {([
                  [1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"],
                  [5, "Fri"], [6, "Sat"], [7, "Sun"],
                ] as const).map(([day, label]) => {
                  const active = editCollectionDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                      onClick={() =>
                        setEditCollectionDays((prev) =>
                          active ? prev.filter((d) => d !== day) : [...prev, day].sort()
                        )
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Days when deductions are collected</p>
            </div>
            <Button className="w-full" onClick={handleSaveEdit} disabled={saving || !editName.trim()}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
            <Separator />
            <Button
              variant="outline"
              className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => { setShowEdit(false); setDeleteConfirmName(""); setShowDelete(true); }}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete Class
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Delete Class
            </DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone. All member data, transactions, and fund records will be lost.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-700">
                To confirm, type the class name: <span className="font-bold">{classData?.name}</span>
              </p>
            </div>
            <Input
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder="Type class name to confirm"
              className="border-red-200 focus-visible:ring-red-500"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowDelete(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={deleting || deleteConfirmName.trim() !== classData?.name}
                onClick={handleDeleteClass}
              >
                {deleting ? "Deleting…" : "Delete Forever"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Calendar Modal */}
      <Dialog open={showCalendar} onOpenChange={setShowCalendar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Collection Calendar
            </DialogTitle>
            <DialogDescription>
              Track daily collection rates and manage no-class days
            </DialogDescription>
          </DialogHeader>
          {(() => {
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
              <div className="space-y-4 pt-2">
                {/* Month Navigation */}
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={prevMonth}
                    disabled={!canGoPrev}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-semibold">
                    {MONTH_NAMES[heatmapMonth - 1]} {heatmapYear}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={nextMonth}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* Day Labels */}
                <div className="grid grid-cols-7 gap-1">
                  {DAY_LABELS.map((d) => (
                    <div key={d} className="text-center text-[10px] text-muted-foreground font-medium">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid */}
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

                {/* Legend — clean grid layout */}
                <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 text-xs text-muted-foreground pt-1">
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-sm bg-muted/40 shrink-0" />
                    <span>Off / Non-collection</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-sm border border-dashed border-muted-foreground/30 shrink-0" />
                    <span>Upcoming</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-sm bg-gray-800 shrink-0" />
                    <span>No class</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-sm bg-red-300 shrink-0" />
                    <span>0–15%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-sm bg-orange-300 shrink-0" />
                    <span>16–65%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-sm bg-green-400 shrink-0" />
                    <span>66–100%</span>
                  </div>
                </div>

                {totalMembers > 0 && (
                  <p className="text-[10px] text-muted-foreground text-center">
                    Based on {totalMembers} active member{totalMembers !== 1 && "s"}
                  </p>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Day Detail Modal */}
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
