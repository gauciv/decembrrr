import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth";
import { getMyRecentDeductions, getMyClass, type Transaction, type ClassData } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TrendingDown, Wallet } from "lucide-react";

/**
 * Student Home Tab — shows current balance and recent daily deductions.
 * This is the default landing view for students after login.
 */
export default function StudentHomeTab() {
  const { profile } = useAuth();
  const [deductions, setDeductions] = useState<Transaction[]>([]);
  const [classData, setClassData] = useState<ClassData | null>(null);

  useEffect(() => {
    if (!profile) return;
    getMyRecentDeductions(profile.id).then(setDeductions);
    if (profile.class_id) {
      getMyClass(profile.class_id).then(setClassData);
    }
  }, [profile]);

  if (!profile) return null;

  const isPositive = profile.balance >= 0;

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <Card
        className={
          isPositive ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
        }
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Wallet className="h-4 w-4" />
            Current Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className={`text-4xl font-bold ${
              isPositive ? "text-green-700" : "text-red-700"
            }`}
          >
            ₱{Math.abs(profile.balance).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </p>
          {!isPositive && (
            <p className="text-sm text-red-600 mt-1">
              You owe ₱{Math.abs(profile.balance).toLocaleString("en-PH", { minimumFractionDigits: 2 })} — please pay your class president.
            </p>
          )}
          {classData && (
            <p className="text-sm text-muted-foreground mt-1">
              {classData.name} · ₱{classData.daily_amount}/
              {classData.collection_frequency === "weekly" ? "week" : "day"}
            </p>
          )}
        </CardContent>
      </Card>

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
