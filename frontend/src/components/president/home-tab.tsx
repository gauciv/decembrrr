import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/auth";
import {
  getMyClass,
  getClassFundSummary,
  getClassDeductionStatus,
  type ClassData,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Target, Users, CheckCircle2, Clock } from "lucide-react";

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

export default function PresidentHomeTab() {
  const { profile } = useAuth();
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [summary, setSummary] = useState({
    totalBalance: 0,
    activeCount: 0,
    totalMembers: 0,
    inDebt: 0,
  });
  const [members, setMembers] = useState<MemberDeductionStatus[]>([]);
  const [activeTab, setActiveTab] = useState<"deducted" | "not-deducted">(
    "not-deducted"
  );

  const loadData = useCallback(async () => {
    if (!profile?.class_id) return;
    const [classInfo, summaryData, statusData] = await Promise.all([
      getMyClass(profile.class_id),
      getClassFundSummary(profile.class_id),
      getClassDeductionStatus(profile.class_id),
    ]);
    setClassData(classInfo);
    setSummary(summaryData);
    setMembers(statusData);
  }, [profile?.class_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!profile?.class_id) return null;

  const goalProgress = classData?.fund_goal
    ? Math.min(100, (summary.totalBalance / classData.fund_goal) * 100)
    : null;

  const deducted = members.filter((m) => m.deductedToday);
  const notDeducted = members.filter((m) => !m.deductedToday);
  const displayList = activeTab === "deducted" ? deducted : notDeducted;

  return (
    <div className="space-y-4">
      {/* Goal Progress Card */}
      <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Target className="h-4 w-4" />
            Class Fund Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-emerald-700">
            ₱
            {summary.totalBalance.toLocaleString("en-PH", {
              minimumFractionDigits: 2,
            })}
          </p>
          {classData?.fund_goal && goalProgress !== null && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{goalProgress.toFixed(0)}% of goal</span>
                <span>₱{classData.fund_goal.toLocaleString("en-PH")}</span>
              </div>
              <div className="h-2.5 rounded-full bg-emerald-200">
                <div
                  className="h-2.5 rounded-full bg-emerald-600 transition-all"
                  style={{ width: `${goalProgress}%` }}
                />
              </div>
            </div>
          )}
          {!classData?.fund_goal && (
            <p className="text-sm text-muted-foreground mt-1">
              No goal set yet.
            </p>
          )}
          <div className="flex items-center gap-3 mt-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {summary.activeCount} active
            </span>
            <span>·</span>
            <span>{summary.totalMembers} total</span>
          </div>
        </CardContent>
      </Card>

      {/* Deduction Status Tabs */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 rounded-lg bg-muted p-1">
            <button
              onClick={() => setActiveTab("not-deducted")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === "not-deducted"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Clock className="inline h-3.5 w-3.5 mr-1" />
              Not Deducted ({notDeducted.length})
            </button>
            <button
              onClick={() => setActiveTab("deducted")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === "deducted"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CheckCircle2 className="inline h-3.5 w-3.5 mr-1" />
              Deducted ({deducted.length})
            </button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {displayList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {activeTab === "deducted"
                ? "No members deducted today yet."
                : "All members have been deducted today."}
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
                  <span
                    className={`text-sm font-semibold ${
                      m.balance >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    ₱{Math.abs(m.balance).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
