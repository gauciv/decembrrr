import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth";
import { getMyRecentDeductions, getMyClass, type Transaction, type ClassData } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TrendingDown, Wallet } from "lucide-react";
import { TabSkeleton } from "@/components/ui/skeleton";

/**
 * Student Home Tab — shows current balance and recent daily deductions.
 * This is the default landing view for students after login.
 */
export default function StudentHomeTab() {
  const { profile } = useAuth();
  const [deductions, setDeductions] = useState<Transaction[]>([]);
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    Promise.all([
      getMyRecentDeductions(profile.id).then(setDeductions),
      profile.class_id ? getMyClass(profile.class_id).then(setClassData) : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, [profile]);

  if (!profile) return null;
  if (loading) return <TabSkeleton />;

  // Balance is always displayed as 0 or positive (wallet balance)
  const displayBalance = Math.max(0, profile.balance);
  // Missed amount is how much they owe if balance went negative
  const missedAmount = profile.balance < 0 ? Math.abs(profile.balance) : 0;

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Wallet className="h-4 w-4" />
            Wallet Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-green-700">
            ₱{displayBalance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </p>
          {classData && (
            <p className="text-sm text-muted-foreground mt-1">
              {classData.name} · ₱{classData.daily_amount}/
              {classData.collection_frequency === "weekly" ? "week" : "day"}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Missed Payments Notice */}
      {missedAmount > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <TrendingDown className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  You have ₱{missedAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })} in missed payments
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  {classData
                    ? `That's about ${Math.ceil(missedAmount / classData.daily_amount)} day${Math.ceil(missedAmount / classData.daily_amount) !== 1 ? "s" : ""} of unpaid contributions. Please pay your class president.`
                    : "Please pay your class president to settle."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Deductions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-1.5">
            <TrendingDown className="h-4 w-4 text-red-500" />
            Recent Deductions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {deductions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No deductions yet — your balance is clear!
            </p>
          ) : (
            <div className="space-y-1">
              {deductions.map((txn, i) => (
                <div key={txn.id}>
                  {i > 0 && <Separator className="my-2" />}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {txn.note || "Daily deduction"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(txn.created_at).toLocaleDateString("en-PH", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <Badge variant="secondary" className="bg-red-100 text-red-700">
                      -₱{txn.amount.toFixed(2)}
                    </Badge>
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
