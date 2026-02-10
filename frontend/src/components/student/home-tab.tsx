import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/auth";
import { getMyRecentDeductions, getMyClass, getNoClassDates, type Transaction, type ClassData, type NoClassDate } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TrendingDown, Wallet } from "lucide-react";
import { TabSkeleton } from "@/components/ui/skeleton";

function useCountdown(targetDate: Date | null) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!targetDate) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  if (!targetDate) return null;
  const diff = Math.max(0, targetDate.getTime() - now.getTime());
  const totalSec = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  };
}

/**
 * Student Home Tab — shows current balance and recent daily deductions.
 * This is the default landing view for students after login.
 */
export default function StudentHomeTab() {
  const { profile } = useAuth();
  const [deductions, setDeductions] = useState<Transaction[]>([]);
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [noClassDates, setNoClassDates] = useState<NoClassDate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    Promise.all([
      getMyRecentDeductions(profile.id).then(setDeductions),
      profile.class_id ? getMyClass(profile.class_id).then(setClassData) : Promise.resolve(),
      profile.class_id ? getNoClassDates(profile.class_id).then(setNoClassDates) : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, [profile]);

  // Compute next deduction date once (must be before early returns — Rules of Hooks)
  const nextDeductionDate = useMemo(() => {
    if (!classData) return null;
    const noClassSet = new Set(noClassDates.map((d) => d.date));
    const collectionDays = classData.collection_days ?? [1, 2, 3, 4, 5];
    const now = new Date();
    for (let offset = 0; offset <= 14; offset++) {
      const d = new Date(now);
      d.setDate(d.getDate() + offset);
      if (offset === 0) {
        d.setHours(0, 0, 0, 0);
        if (d.getTime() <= now.getTime()) continue;
      }
      const jsDay = d.getDay();
      const isoDay = jsDay === 0 ? 7 : jsDay;
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (collectionDays.includes(isoDay) && !noClassSet.has(dateStr)) {
        d.setHours(0, 0, 0, 0);
        return d;
      }
    }
    return null;
  }, [classData, noClassDates]);

  const countdown = useCountdown(nextDeductionDate);

  if (!profile) return null;
  if (loading) return <TabSkeleton />;

  // Balance is always displayed as 0 or positive (wallet balance)
  const displayBalance = Math.max(0, profile.balance);
  // Missed amount is how much they owe if balance went negative
  const missedAmount = profile.balance < 0 ? Math.abs(profile.balance) : 0;

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <div className="space-y-0">
        <Card className="border-green-200 bg-green-50 rounded-b-none">
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
          </CardContent>
        </Card>

        {/* Next Deduction Countdown Strip */}
        {classData && countdown && (
          <div className="rounded-b-xl bg-gray-900 text-white px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">{classData.name}</p>
              <p className="text-[10px] text-gray-400">₱{classData.daily_amount}/{classData.collection_frequency === "weekly" ? "week" : "day"} · Next deduction</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {[
                { value: countdown.days, label: "D" },
                { value: countdown.hours, label: "H" },
                { value: countdown.minutes, label: "M" },
                { value: countdown.seconds, label: "S" },
              ].map(({ value, label }) => (
                <div key={label} className="flex flex-col items-center">
                  <span className="bg-yellow-400 text-gray-900 font-bold text-sm rounded px-1.5 py-0.5 min-w-[28px] text-center tabular-nums">
                    {String(value).padStart(2, "0")}
                  </span>
                  <span className="text-[9px] text-gray-400 mt-0.5">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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
