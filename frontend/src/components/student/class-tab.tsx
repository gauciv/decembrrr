import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth";
import {
  getMyClass,
  getClassFundSummary,
  getClassTodayStatus,
  type ClassData,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Target, Users, CheckCircle2, XCircle } from "lucide-react";

interface MemberStatus {
  id: string;
  name: string;
  avatar_url: string | null;
  paidToday: boolean;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
}

/**
 * Student Class Tab — shows the class fund goal progress
 * and today's payment status for each classmate.
 */
export default function StudentClassTab() {
  const { profile } = useAuth();
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [summary, setSummary] = useState({ totalBalance: 0, activeCount: 0, totalMembers: 0 });
  const [members, setMembers] = useState<MemberStatus[]>([]);

  useEffect(() => {
    if (!profile?.class_id) return;
    getMyClass(profile.class_id).then(setClassData);
    getClassFundSummary(profile.class_id).then(setSummary);
    getClassTodayStatus(profile.class_id).then(setMembers);
  }, [profile]);

  /* No class joined yet */
  if (!profile?.class_id) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-semibold mb-1">No class yet</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Ask your class president for the invite code or QR link and join from the onboarding screen.
        </p>
      </div>
    );
  }

  const goalProgress = classData?.fund_goal
    ? Math.min(100, (summary.totalBalance / classData.fund_goal) * 100)
    : null;

  const paidCount = members.filter((m) => m.paidToday).length;
  const unpaidMembers = members.filter((m) => !m.paidToday);
  const paidMembers = members.filter((m) => m.paidToday);

  return (
    <div className="space-y-6">
      {/* Fund Goal Progress */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Target className="h-4 w-4" />
            Class Fund Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-blue-700">
            ₱{summary.totalBalance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </p>
          {classData?.fund_goal && goalProgress !== null && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{goalProgress.toFixed(0)}% of goal</span>
                <span>₱{classData.fund_goal.toLocaleString("en-PH")}</span>
              </div>
              <div className="h-2.5 rounded-full bg-blue-200">
                <div
                  className="h-2.5 rounded-full bg-blue-600 transition-all"
                  style={{ width: `${goalProgress}%` }}
                />
              </div>
            </div>
          )}
          {!classData?.fund_goal && (
            <p className="text-sm text-muted-foreground mt-1">
              No goal set — ask your president to set one.
            </p>
          )}
          <div className="flex items-center gap-3 mt-3 text-sm text-muted-foreground">
            <span>{summary.totalMembers} members</span>
            <span>·</span>
            <span>{summary.activeCount} active</span>
          </div>
        </CardContent>
      </Card>

      {/* Today's Payment Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Today's Status</CardTitle>
            <span className="text-xs text-muted-foreground">
              {paidCount}/{members.length} paid
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Loading classmates…
            </p>
          ) : (
            <>
              {/* Unpaid first — these need attention */}
              {unpaidMembers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-red-600 uppercase tracking-wider">
                    Haven't paid yet
                  </p>
                  {unpaidMembers.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 rounded-lg p-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={m.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">{initials(m.name)}</AvatarFallback>
                      </Avatar>
                      <p className="text-sm flex-1 truncate">{m.name}</p>
                      <XCircle className="h-4 w-4 text-red-400" />
                    </div>
                  ))}
                </div>
              )}

              {/* Paid */}
              {paidMembers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-green-600 uppercase tracking-wider">
                    Paid today
                  </p>
                  {paidMembers.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 rounded-lg p-2 opacity-70">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={m.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">{initials(m.name)}</AvatarFallback>
                      </Avatar>
                      <p className="text-sm flex-1 truncate">{m.name}</p>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
