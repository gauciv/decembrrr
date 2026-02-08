import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/auth";
import {
  getClassMembers,
  getMyClass,
  recordDeposit,
  getMyTransactions,
  getStudentPaymentStats,
  buildStudentEmailUri,
  type Transaction,
  type ClassData,
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
} from "lucide-react";
import { getErrorMessage } from "@/lib/errors";

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

  // Invite dialog
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState(false);

  // Email
  const [emailLoading, setEmailLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!profile?.class_id) return;
    const [membersData, classInfo] = await Promise.all([
      getClassMembers(profile.class_id),
      getMyClass(profile.class_id),
    ]);
    setMembers(membersData.sort((a, b) => a.name.localeCompare(b.name)));
    setClassData(classInfo);
  }, [profile?.class_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
  );

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
    const txns = await getMyTransactions(student.id, 30);
    setLogTxns(txns);
  }

  function copyInviteCode() {
    if (!classData?.invite_code) return;
    navigator.clipboard.writeText(classData.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  if (!profile?.class_id) return null;

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700 text-center">
          {toast}
        </div>
      )}

      {/* Search + Add Student */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search students…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          size="icon"
          variant="outline"
          onClick={() => setShowInvite(true)}
          aria-label="Add student"
        >
          <UserPlus className="h-4 w-4" />
        </Button>
      </div>

      {/* Student List */}
      <div className="space-y-1">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No students found
          </p>
        ) : (
          filtered.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 rounded-lg border p-3"
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
                    {member.id === profile.id && (
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
          ))
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
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={emailLoading}
                onClick={() => sendStudentEmail(logStudent)}
              >
                <Mail className="h-4 w-4 mr-1.5" />
                {emailLoading ? "Preparing…" : "Email Payment Summary"}
              </Button>
            </div>
          )}

          <div className="max-h-80 overflow-y-auto space-y-1 pt-2">
            {logTxns.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No transactions yet
              </p>
            ) : (
              logTxns.map((txn, i) => (
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
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Students</DialogTitle>
            <DialogDescription>
              Share the invite code or QR with your classmates
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {classData && (
              <>
                {/* Invite code */}
                <button
                  onClick={copyInviteCode}
                  className="flex w-full items-center justify-between rounded-lg border-2 border-dashed p-4 hover:bg-muted/50 transition-colors"
                >
                  <span className="font-mono text-2xl tracking-widest font-bold">
                    {classData.invite_code}
                  </span>
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    {copied ? (
                      "Copied!"
                    ) : (
                      <>
                        <Copy className="h-4 w-4" /> Copy
                      </>
                    )}
                  </span>
                </button>
                {/* QR Code */}
                <div className="flex flex-col items-center">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                      `${window.location.origin}/join?code=${classData.invite_code}`
                    )}`}
                    alt="QR code to join class"
                    className="h-40 w-40 rounded-lg"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Students scan this to join instantly
                  </p>
                </div>
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
    </div>
  );
}
