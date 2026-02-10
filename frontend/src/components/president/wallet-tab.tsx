import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/auth";
import {
  getWalletSummary,
  getMyClass,
  getClassDeductionStatus,
  exportTransactionsCsv,
  type WalletSummary,
  type ClassData,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Wallet,
  Download,
  Users,
  Search,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { TabSkeleton } from "@/components/ui/skeleton";
import { useAutoRefresh } from "@/lib/use-auto-refresh";

// --- Helpers ---

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2);
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
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [toast, setToast] = useState("");
  const [txnSearch, setTxnSearch] = useState("");

  // Member list pagination
  const [memberPage, setMemberPage] = useState(0);
  const MEMBERS_PER_PAGE = 5;

  const loadData = useCallback(async () => {
    if (!profile?.class_id) return;
    setLoading(true);
    try {
      const [w, c, statusData] = await Promise.all([
        getWalletSummary(profile.class_id),
        getMyClass(profile.class_id),
        getClassDeductionStatus(profile.class_id),
      ]);
      setWallet(w);
      setClassData(c);
      setMembers(statusData);
    } finally {
      setLoading(false);
    }
  }, [profile?.class_id]);

  useEffect(() => { loadData(); }, [loadData]);

  useAutoRefresh(loadData);

  // Filtered transaction list (today's deductions/contributions)
  const filteredMembers = members.filter((m) =>
    m.name.toLowerCase().includes(txnSearch.toLowerCase())
  );
  const contributed = filteredMembers.filter((m) => m.deductedToday);
  const missed = filteredMembers.filter((m) => !m.deductedToday);

  // Paginated combined list: contributed first, then missed
  const orderedMembers = [...contributed, ...missed];
  const memberTotalPages = Math.max(1, Math.ceil(orderedMembers.length / MEMBERS_PER_PAGE));
  const paginatedMembers = orderedMembers.slice(memberPage * MEMBERS_PER_PAGE, (memberPage + 1) * MEMBERS_PER_PAGE);

  // Reset page when search changes
  useEffect(() => { setMemberPage(0); }, [txnSearch]);

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
          <div className="min-h-[280px] space-y-0.5">
            {paginatedMembers.length > 0 ? (
              paginatedMembers.map((m) => {
                const isPaid = m.deductedToday;
                return (
                  <div key={m.id} className="flex items-center gap-2.5 rounded-lg p-2 hover:bg-muted/50">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={m.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px]">{initials(m.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.name}</p>
                    </div>
                    <span className={`flex items-center gap-1 text-xs font-medium shrink-0 ${isPaid ? "text-green-600" : "text-red-500"}`}>
                      {isPaid ? <><CheckCircle2 className="h-3 w-3" /> Paid</> : <><XCircle className="h-3 w-3" /> Missed</>}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No members found
              </p>
            )}
          </div>
          {memberTotalPages > 1 && (
            <div className="flex items-center justify-between pt-2 border-t mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMemberPage((p) => Math.max(0, p - 1))}
                disabled={memberPage === 0}
                className="h-7 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-0.5" /> Prev
              </Button>
              <span className="text-xs text-muted-foreground">
                {memberPage + 1} / {memberTotalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMemberPage((p) => Math.min(memberTotalPages - 1, p + 1))}
                disabled={memberPage >= memberTotalPages - 1}
                className="h-7 text-xs"
              >
                Next <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
              </Button>
            </div>
          )}
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
    </div>
  );
}
