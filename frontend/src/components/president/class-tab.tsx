import { useEffect, useState, useCallback } from "react";
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
  type Transaction,
  type ClassData,
  type UpdateClassInput,
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
} from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { TabSkeleton } from "@/components/ui/skeleton";

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

  const loadData = useCallback(async () => {
    if (!profile?.class_id) return;
    try {
      const [membersData, classInfo] = await Promise.all([
        getClassMembers(profile.class_id),
        getMyClass(profile.class_id),
      ]);
      setMembers(membersData.sort((a, b) => a.name.localeCompare(b.name)));
      setClassData(classInfo);
    } finally {
      setInitialLoading(false);
    }
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
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  async function copyQrImage() {
    if (!classData?.invite_code) return;
    try {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(
        `${window.location.origin}/join?code=${classData.invite_code}`
      )}`;
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setQrCopied(true);
      setTimeout(() => setQrCopied(false), 2000);
    } catch {
      navigator.clipboard.writeText(
        `${window.location.origin}/join?code=${classData.invite_code}`
      );
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
    </div>
  );
}
