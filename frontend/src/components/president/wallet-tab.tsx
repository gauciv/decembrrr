import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/auth";
import {
  getWalletSummary,
  getMyClass,
  exportTransactionsCsv,
  type WalletSummary,
  type ClassData,
} from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Wallet,
  Download,
  TrendingUp,
  TrendingDown,
  Users,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { getErrorMessage } from "@/lib/errors";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
}

export default function PresidentWalletTab() {
  const { profile } = useAuth();
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [toast, setToast] = useState("");

  const loadData = useCallback(async () => {
    if (!profile?.class_id) return;
    setLoading(true);
    try {
      const [w, c] = await Promise.all([
        getWalletSummary(profile.class_id),
        getMyClass(profile.class_id),
      ]);
      setWallet(w);
      setClassData(c);
    } finally {
      setLoading(false);
    }
  }, [profile?.class_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">Loading wallet…</p>
      </div>
    );
  }

  if (!wallet || !classData) return null;

  const goalProgress =
    classData.fund_goal && classData.fund_goal > 0
      ? Math.min(100, Math.round((wallet.totalBalance / classData.fund_goal) * 100))
      : null;

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700 text-center">
          {toast}
        </div>
      )}

      {/* Total Balance Card */}
      <div className="rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 p-5 text-white">
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="h-5 w-5 opacity-80" />
          <span className="text-sm font-medium opacity-80">Class Fund</span>
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

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border p-3 space-y-1">
          <div className="flex items-center gap-1.5">
            <ArrowUpRight className="h-4 w-4 text-green-600" />
            <span className="text-xs text-muted-foreground">Total Deposits</span>
          </div>
          <p className="text-lg font-bold text-green-600">
            ₱{wallet.totalDeposits.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-lg border p-3 space-y-1">
          <div className="flex items-center gap-1.5">
            <ArrowDownRight className="h-4 w-4 text-red-500" />
            <span className="text-xs text-muted-foreground">Total Deductions</span>
          </div>
          <p className="text-lg font-bold text-red-500">
            ₱{wallet.totalDeductions.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-lg border p-3 space-y-1">
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-muted-foreground">Members</span>
          </div>
          <p className="text-lg font-bold">
            {wallet.activeMembers}
            <span className="text-sm font-normal text-muted-foreground">
              /{wallet.totalMembers}
            </span>
          </p>
        </div>
        <div className="rounded-lg border p-3 space-y-1">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-muted-foreground">In Debt</span>
          </div>
          <p className="text-lg font-bold text-amber-500">{wallet.inDebt}</p>
        </div>
      </div>

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

      <Separator />

      {/* Member Balances */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          Member Balances
        </h3>
        <div className="space-y-1">
          {wallet.memberBalances.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={member.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {initials(member.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium truncate">{member.name}</p>
                  {!member.is_active && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      Inactive
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {member.email}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p
                  className={`text-sm font-semibold flex items-center gap-0.5 ${
                    member.balance >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {member.balance >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  ₱{Math.abs(member.balance).toFixed(2)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
