import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth";
import {
  getClassMembers,
  getClassFundSummary,
  getClassTransactions,
  getMyClass,
  exportTransactionsCsv,
  type ClassData,
} from "@/lib/api";
import type { Profile } from "@/context/auth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Download, Users, UserCheck, AlertTriangle, Target } from "lucide-react";

interface TransactionWithProfile {
  id: string;
  type: "deposit" | "deduction";
  amount: number;
  note: string;
  created_at: string;
  profiles: { name: string };
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
}

export default function FundPage() {
  const { profile } = useAuth();
  const [members, setMembers] = useState<Profile[]>([]);
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [summary, setSummary] = useState({
    totalBalance: 0,
    activeCount: 0,
    totalMembers: 0,
    inDebt: 0,
  });
  const [recentTxns, setRecentTxns] = useState<TransactionWithProfile[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!profile?.class_id) return;
    getClassMembers(profile.class_id).then(setMembers);
    getClassFundSummary(profile.class_id).then(setSummary);
    getMyClass(profile.class_id).then(setClassData);
    if (profile.role === "president") {
      getClassTransactions(profile.class_id, 20).then(setRecentTxns);
    }
  }, [profile]);

  if (!profile?.class_id) return null;

  async function handleExport() {
    if (!profile?.class_id) return;
    setExporting(true);
    try {
      await exportTransactionsCsv(profile.class_id);
    } finally {
      setExporting(false);
    }
  }

  const goalProgress = classData?.fund_goal
    ? Math.min(100, (summary.totalBalance / classData.fund_goal) * 100)
    : null;

  return (
    <div className="space-y-6">
      {/* Fund Summary */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Class Fund
            </CardTitle>
            {profile.role === "president" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExport}
                disabled={exporting}
                className="text-blue-700 hover:text-blue-800"
              >
                <Download className="h-4 w-4 mr-1" />
                {exporting ? "Exporting…" : "CSV"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-blue-700">
            ₱{summary.totalBalance.toLocaleString("en-PH", {
              minimumFractionDigits: 2,
            })}
          </p>
          {classData?.fund_goal && goalProgress !== null && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span className="flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  {goalProgress.toFixed(0)}% of goal
                </span>
                <span>₱{classData.fund_goal.toLocaleString("en-PH")}</span>
              </div>
              <div className="h-2 rounded-full bg-blue-200">
                <div
                  className="h-2 rounded-full bg-blue-600 transition-all"
                  style={{ width: `${goalProgress}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-5 text-center">
            <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xl font-bold">{summary.totalMembers}</p>
            <p className="text-xs text-muted-foreground">Members</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <UserCheck className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xl font-bold">{summary.activeCount}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <AlertTriangle className="h-4 w-4 mx-auto mb-1 text-red-500" />
            <p className="text-xl font-bold text-red-600">{summary.inDebt}</p>
            <p className="text-xs text-muted-foreground">In Debt</p>
          </CardContent>
        </Card>
      </div>

      {/* Member Balances */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Member Balances</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 rounded-lg p-2"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={member.avatar_url || undefined} />
                <AvatarFallback>{initials(member.name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {member.name}
                  {member.role === "president" && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      (President)
                    </span>
                  )}
                </p>
              </div>
              <Badge
                variant={member.balance >= 0 ? "default" : "destructive"}
                className={member.balance >= 0 ? "bg-green-600" : ""}
              >
                ₱{member.balance.toFixed(2)}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recent Transactions (president only) */}
      {profile.role === "president" && recentTxns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Class Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {recentTxns.map((txn, i) => (
                <div key={txn.id}>
                  {i > 0 && <Separator className="my-2" />}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {txn.profiles?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {txn.note} ·{" "}
                        {new Date(txn.created_at).toLocaleDateString("en-PH", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <Badge
                      variant={
                        txn.type === "deposit" ? "default" : "secondary"
                      }
                      className={
                        txn.type === "deposit" ? "bg-green-600" : "bg-gray-500"
                      }
                    >
                      {txn.type === "deposit" ? "+" : "-"}₱
                      {txn.amount.toFixed(2)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
