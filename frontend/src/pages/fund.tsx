import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth";
import {
  getClassMembers,
  getClassFundSummary,
  getClassTransactions,
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
import { Separator } from "@/components/ui/separator";

interface TransactionWithProfile {
  id: string;
  type: "deposit" | "deduction";
  amount: number;
  note: string;
  created_at: string;
  profiles: { name: string };
}

export default function FundPage() {
  const { profile } = useAuth();
  const [members, setMembers] = useState<Profile[]>([]);
  const [summary, setSummary] = useState({
    totalBalance: 0,
    activeCount: 0,
    totalMembers: 0,
    inDebt: 0,
  });
  const [recentTxns, setRecentTxns] = useState<TransactionWithProfile[]>([]);

  useEffect(() => {
    if (!profile?.class_id) return;
    getClassMembers(profile.class_id).then(setMembers);
    getClassFundSummary(profile.class_id).then(setSummary);
    if (profile.role === "president") {
      getClassTransactions(profile.class_id, 20).then(setRecentTxns);
    }
  }, [profile]);

  if (!profile?.class_id) return null;

  return (
    <div className="space-y-6">
      {/* Fund Summary */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Class Fund
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-blue-700">
            ₱{summary.totalBalance.toFixed(2)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            This should match your physical cash on hand
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-xl font-bold">{summary.totalMembers}</p>
            <p className="text-xs text-muted-foreground">Members</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-xl font-bold">{summary.activeCount}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
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
                <AvatarFallback>
                  {member.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </AvatarFallback>
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
