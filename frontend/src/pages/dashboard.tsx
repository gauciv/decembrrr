import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth";
import { getMyTransactions, getMyClass, type Transaction, type ClassData } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function DashboardPage() {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [classData, setClassData] = useState<ClassData | null>(null);

  useEffect(() => {
    if (!profile) return;
    getMyTransactions(profile.id).then(setTransactions);
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
          isPositive
            ? "border-green-200 bg-green-50"
            : "border-red-200 bg-red-50"
        }
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Your Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className={`text-4xl font-bold ${
              isPositive ? "text-green-700" : "text-red-700"
            }`}
          >
            ₱{profile.balance.toFixed(2)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {classData?.name} · ₱{classData?.daily_amount ?? 10}/day
          </p>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">
              {Math.max(0, Math.floor(profile.balance / (classData?.daily_amount ?? 10)))}
            </p>
            <p className="text-xs text-muted-foreground">Days Covered</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{transactions.length}</p>
            <p className="text-xs text-muted-foreground">Transactions</p>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No transactions yet
            </p>
          ) : (
            <div className="space-y-1">
              {transactions.map((txn, i) => (
                <div key={txn.id}>
                  {i > 0 && <Separator className="my-2" />}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {txn.note || txn.type}
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
                    <Badge
                      variant={txn.type === "deposit" ? "default" : "secondary"}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
