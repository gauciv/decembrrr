import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/auth";
import {
  getClassMembers,
  recordDeposit,
  getMyClass,
  type ClassData,
} from "@/lib/api";
import type { Profile } from "@/context/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function PaymentsPage() {
  const { profile } = useAuth();
  const [members, setMembers] = useState<Profile[]>([]);
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  const loadMembers = useCallback(async () => {
    if (!profile?.class_id) return;
    const data = await getClassMembers(profile.class_id);
    setMembers(data);
  }, [profile?.class_id]);

  useEffect(() => {
    loadMembers();
    if (profile?.class_id) {
      getMyClass(profile.class_id).then(setClassData);
    }
  }, [profile, loadMembers]);

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
      setSuccess(`₱${amount} recorded for ${selected.name}`);
      setSelected(null);
      setAmount("");
      setNote("");
      loadMembers();
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setSuccess("Failed to record payment");
    } finally {
      setLoading(false);
    }
  }

  if (!profile?.is_president) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Only the class president can receive payments.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {success && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700 text-center">
          {success}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Receive Payment</CardTitle>
          <CardDescription>
            Select a student to record their cash payment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {members.map((member) => (
            <button
              key={member.id}
              onClick={() => setSelected(member)}
              className="flex w-full items-center gap-3 rounded-lg border p-3 text-left hover:bg-accent transition-colors"
            >
              <Avatar className="h-9 w-9">
                <AvatarImage src={member.avatar_url || undefined} />
                <AvatarFallback>
                  {member.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{member.name}</p>
                <p className="text-xs text-muted-foreground">{member.email}</p>
              </div>
              <Badge
                variant={member.balance >= 0 ? "default" : "destructive"}
                className={member.balance >= 0 ? "bg-green-600" : ""}
              >
                ₱{member.balance.toFixed(2)}
              </Badge>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Invite Code Card */}
      {classData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite Code</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center font-mono text-2xl tracking-widest font-bold">
              {classData.invite_code}
            </p>
            <p className="text-center text-xs text-muted-foreground mt-2">
              Share this code with classmates to join
            </p>
          </CardContent>
        </Card>
      )}

      {/* Deposit Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receive Payment</DialogTitle>
            <DialogDescription>
              Recording payment for {selected?.name}
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
            {/* Quick amount buttons */}
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
                placeholder="e.g. Week payment"
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
    </div>
  );
}
