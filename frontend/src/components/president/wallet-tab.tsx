import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/auth";
import {
  getWalletSummary,
  getMyClass,
  exportTransactionsCsv,
  type WalletSummary,
  type ClassData,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  Download,
  Users,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { getErrorMessage } from "@/lib/errors";

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
    </div>
  );
}
