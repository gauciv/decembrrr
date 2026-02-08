import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/auth";
import {
  getMyClass,
  getClassMembers,
  getClassFundSummary,
  recordDeposit,
  type Transaction,
  type ClassData,
} from "@/lib/api";
// getMyTransactions is dynamically imported in viewHistory()
import type { Profile } from "@/context/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Search,
  MoreVertical,
  TrendingUp,
  TrendingDown,
  Users,
  AlertCircle,
  History,
} from "lucide-react";
import { getErrorMessage } from "@/lib/errors";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
}

// ─── President Dashboard ────────────────────────────────────────────────────

function PresidentDashboard() {
  const { profile, refreshProfile } = useAuth();
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [summary, setSummary] = useState({
    totalBalance: 0,
    activeCount: 0,
    totalMembers: 0,
    inDebt: 0,
  });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Profile | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [historyStudent, setHistoryStudent] = useState<Profile | null>(null);
  const [historyTxns, setHistoryTxns] = useState<Transaction[]>([]);

  const loadData = useCallback(async () => {
    if (!profile?.class_id) return;
    const [membersData, summaryData, classInfo] = await Promise.all([
      getClassMembers(profile.class_id),
      getClassFundSummary(profile.class_id),
      getMyClass(profile.class_id),
    ]);
    // Sort by lowest balance first (defaulters at top)
    setMembers(membersData.sort((a, b) => a.balance - b.balance));
    setSummary(summaryData);
    setClassData(classInfo);
  }, [profile?.class_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleDeposit() {
    if (!selected || !amount || !profile?.class_id) return;
    setLoading(true);
    try {
      await recordDeposit(
        selected.id,
        profile.class_id,
        parseFloat(amount),
        note || undefined
      );
      setToast(`₱${amount} recorded for ${selected.name}`);
      setSelected(null);
      setAmount("");
      setNote("");
      await loadData();
      await refreshProfile();
      setTimeout(() => setToast(""), 3000);
    } catch (err) {
      setToast(getErrorMessage(err));
      setTimeout(() => setToast(""), 4000);
    } finally {
      setLoading(false);
    }
  }

  async function viewHistory(student: Profile) {
    setMenuOpen(null);
    setHistoryStudent(student);
    const { getMyTransactions } = await import("@/lib/api");
    const txns = await getMyTransactions(student.id, 30);
    setHistoryTxns(txns);
  }

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
  );

  const unpaidCount = members.filter((m) => m.balance < 0).length;

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700 text-center">
          {toast}
        </div>
      )}

      {/* ── The Money Pot ── */}
      <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-green-700 p-5 text-white">
        <p className="text-sm font-medium text-white/80">Total Class Fund</p>
        <p className="text-4xl font-bold mt-1">
          ₱{summary.totalBalance.toLocaleString("en-PH", {
            minimumFractionDigits: 2,
          })}
        </p>
        {classData?.fund_goal && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-white/70 mb-1">
              <span>Progress to goal</span>
              <span>
                ₱{classData.fund_goal.toLocaleString("en-PH")}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/20">
              <div
                className="h-2 rounded-full bg-white/80 transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    (summary.totalBalance / classData.fund_goal) * 100
                  )}%`,
                }}
              />
            </div>
          </div>
        )}
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-white/70" />
            <span className="text-sm">{summary.activeCount} active</span>
          </div>
          {unpaidCount > 0 && (
            <div className="flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-red-300" />
              <span className="text-sm text-red-200">
                {unpaidCount} unpaid
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Search + Student Ledger ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Find student…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="space-y-1">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No students found
          </p>
        ) : (
          filtered.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 rounded-lg border p-3 relative"
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
                  {member.id === profile?.id && (
                    <span className="text-xs text-muted-foreground ml-1">
                      (You)
                    </span>
                  )}
                </p>
                <p
                  className={`text-sm font-semibold ${
                    member.balance >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {member.balance >= 0 ? (
                    <TrendingUp className="inline h-3 w-3 mr-0.5" />
                  ) : (
                    <TrendingDown className="inline h-3 w-3 mr-0.5" />
                  )}
                  ₱{Math.abs(member.balance).toFixed(2)}
                </p>
              </div>
              {/* Actions */}
              <div className="relative">
                <button
                  onClick={() =>
                    setMenuOpen(menuOpen === member.id ? null : member.id)
                  }
                  className="p-2 rounded-md hover:bg-accent transition-colors"
                >
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                </button>
                {menuOpen === member.id && (
                  <div className="absolute right-0 top-10 z-50 w-44 rounded-lg border bg-popover shadow-md py-1">
                    <button
                      onClick={() => {
                        setMenuOpen(null);
                        setSelected(member);
                      }}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors flex items-center gap-2"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Payment
                    </button>
                    <button
                      onClick={() => viewHistory(member)}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors flex items-center gap-2"
                    >
                      <History className="h-3.5 w-3.5" />
                      View History
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── FAB: Receive Payment ── */}
      <button
        onClick={() => {
          if (members.length > 0) setSelected(members[0]);
        }}
        className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
        aria-label="Receive payment"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* ── Deposit Dialog ── */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receive Payment</DialogTitle>
            <DialogDescription>
              {selected && (
                <span className="flex items-center gap-2 mt-1">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={selected.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {initials(selected.name)}
                    </AvatarFallback>
                  </Avatar>
                  {selected.name} · Balance: ₱{selected.balance.toFixed(2)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Student selector if opened from FAB */}
            <div>
              <label className="text-sm font-medium">Student</label>
              <select
                value={selected?.id ?? ""}
                onChange={(e) => {
                  const m = members.find((m) => m.id === e.target.value);
                  if (m) setSelected(m);
                }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} (₱{m.balance.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
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
              disabled={loading || !amount || parseFloat(amount) <= 0}
            >
              {loading ? "Recording…" : `Confirm ₱${amount || "0"}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Student History Dialog ── */}
      <Dialog
        open={!!historyStudent}
        onOpenChange={() => setHistoryStudent(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{historyStudent?.name}</DialogTitle>
            <DialogDescription>Transaction history</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-1 pt-2">
            {historyTxns.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No transactions yet
              </p>
            ) : (
              historyTxns.map((txn, i) => (
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
                          : "bg-gray-500"
                      }
                    >
                      {txn.type === "deposit" ? "+" : "-"}₱
                      {txn.amount.toFixed(2)}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Student Dashboard ──────────────────────────────────────────────────────
// Students now see the Home tab (balance + recent deductions) at "/" route.
// Their other views (Transactions, Class) are separate routes.

import StudentHomeTab from "@/components/student/home-tab";

function StudentDashboard() {
  return <StudentHomeTab />;
}

// ─── Exported Page ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { profile } = useAuth();
  if (!profile) return null;

  return profile.role === "president" ? (
    <PresidentDashboard />
  ) : (
    <StudentDashboard />
  );
}
