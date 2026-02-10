import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/auth";
import {
  getMyClass,
  getClassFundSummary,
  getClassDeductionStatus,
  type ClassData,
} from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, CheckCircle2, XCircle, Wallet, CalendarDays, TrendingUp } from "lucide-react";
import { TabSkeleton } from "@/components/ui/skeleton";
import { useAutoRefresh } from "@/lib/use-auto-refresh";

interface MemberDeductionStatus {
  id: string;
  name: string;
  avatar_url: string | null;
  balance: number;
  deductedToday: boolean;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
}

function balanceStatus(balance: number): { label: string; color: string; dot: string } {
  if (balance <= 0) return { label: "No Balance", color: "text-red-600", dot: "bg-red-500" };
  if (balance < 50) return { label: "Low Balance", color: "text-amber-500", dot: "bg-amber-400" };
  return { label: "Good", color: "text-green-600", dot: "bg-green-500" };
}

function formatToday(): string {
  return new Date().toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function PresidentHomeTab() {
  const { profile } = useAuth();
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [summary, setSummary] = useState({
    totalBalance: 0,
    totalDeposits: 0,
    totalDeductions: 0,
    activeCount: 0,
    totalMembers: 0,
    collectionDayCount: 0,
    expectedTotal: 0,
    collectionRate: 0,
    dailyAmount: 0,
  });
  const [members, setMembers] = useState<MemberDeductionStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"missed" | "contributed">(
    "missed"
  );

  const loadData = useCallback(async () => {
    if (!profile?.class_id) return;
    setLoading(true);
    try {
      const [classInfo, summaryData, statusData] = await Promise.all([
        getMyClass(profile.class_id),
        getClassFundSummary(profile.class_id),
        getClassDeductionStatus(profile.class_id),
      ]);
      setClassData(classInfo);
      setSummary(summaryData);
      setMembers(statusData);
    } finally {
      setLoading(false);
    }
  }, [profile?.class_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useAutoRefresh(loadData);

  if (!profile?.class_id) return null;
  if (loading) return <TabSkeleton />;

  const goalProgress = classData?.fund_goal
    ? Math.min(100, (summary.totalBalance / classData.fund_goal) * 100)
    : null;

  // Total balance students are still holding (undeducted deposits)
  const totalStudentBalances = members.reduce((s, m) => s + Math.max(0, m.balance), 0);

  const contributed = members.filter((m) => m.deductedToday);
  const missed = members.filter((m) => !m.deductedToday);
  const displayList = activeTab === "contributed" ? contributed : missed;

  return (
    <div className="space-y-4">
      {/* Date Stamp */}
      <p className="text-sm text-muted-foreground">{formatToday()}</p>

      {/* Class Fund Card */}
      <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 p-5 text-white">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 opacity-80" />
            <span className="text-sm font-medium opacity-80">Class Fund</span>
          </div>
          <div className="flex items-center gap-1 text-sm opacity-80">
            <Users className="h-3.5 w-3.5" />
            <span>{summary.activeCount}/{summary.totalMembers}</span>
          </div>
        </div>
        <p className="text-3xl font-bold tracking-tight">
          ₱{summary.totalBalance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
        </p>
        {classData?.fund_goal && goalProgress !== null && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="opacity-80">Goal Progress</span>
              <span className="font-medium">
                {goalProgress.toFixed(0)}% of ₱{classData.fund_goal.toLocaleString("en-PH")}
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

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Collection</span>
          </div>
          <p className="text-lg font-bold">{summary.collectionRate}%</p>
          <p className="text-[10px] text-muted-foreground">{summary.collectionDayCount} day{summary.collectionDayCount !== 1 ? "s" : ""} so far</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Deposits</span>
          </div>
          <p className="text-lg font-bold">₱{summary.totalDeposits.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">Cash collected</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Wallets</span>
          </div>
          <p className="text-lg font-bold">₱{totalStudentBalances.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">Student bal.</p>
        </Card>
      </div>

      {/* Contribution Status Tabs */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 rounded-lg bg-muted p-1">
            <button
              onClick={() => setActiveTab("missed")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === "missed"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <XCircle className="inline h-3.5 w-3.5 mr-1" />
              Missed ({missed.length})
            </button>
            <button
              onClick={() => setActiveTab("contributed")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === "contributed"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CheckCircle2 className="inline h-3.5 w-3.5 mr-1" />
              Contributed ({contributed.length})
            </button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {displayList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {activeTab === "contributed"
                ? "No contributions recorded today yet."
                : "Everyone has contributed today! 🎉"}
            </p>
          ) : (
            <div className="space-y-1">
              {displayList.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-lg p-2.5"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={m.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {initials(m.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {m.name}
                      {m.id === profile.id && (
                        <span className="text-xs text-muted-foreground ml-1">
                          (You)
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {(() => {
                      const status = balanceStatus(m.balance);
                      return (
                        <>
                          <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                          <span className={`text-sm font-medium ${status.color}`}>
                            {status.label}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
