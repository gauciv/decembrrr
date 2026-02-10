import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth";
import {
  getMyClass,
  getClassFundSummary,
  getClassMembers,
  type ClassData,
} from "@/lib/api";
import type { Profile } from "@/context/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Target, Users, Search, TrendingUp, TrendingDown } from "lucide-react";
import { TabSkeleton } from "@/components/ui/skeleton";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
}

/**
 * Student Class Tab — shows the class fund goal progress
 * and a searchable list of all class members with balances.
 */
export default function StudentClassTab() {
  const { profile } = useAuth();
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [summary, setSummary] = useState({ totalBalance: 0, activeCount: 0, totalMembers: 0 });
  const [members, setMembers] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.class_id) return;
    Promise.all([
      getMyClass(profile.class_id).then(setClassData),
      getClassFundSummary(profile.class_id).then(setSummary),
      getClassMembers(profile.class_id).then((m) => setMembers(m.sort((a, b) => a.name.localeCompare(b.name)))),
    ]).finally(() => setLoading(false));
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

  if (loading) return <TabSkeleton />;

  const goalProgress = classData?.fund_goal
    ? Math.min(100, (summary.totalBalance / classData.fund_goal) * 100)
    : null;

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search classmates…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Class Member List */}
      <div className="space-y-1">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No classmates found
          </p>
        ) : (
          filtered.map((member) => {
            const isMe = member.id === profile.id;
            const balance = Math.max(0, member.balance);
            return (
              <div
                key={member.id}
                className={`flex items-center gap-3 rounded-lg border p-3 ${isMe ? "bg-primary/5 border-primary/20" : ""}`}
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={member.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {initials(member.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {member.name}
                    {isMe && (
                      <Badge variant="outline" className="ml-1.5 text-[10px] px-1.5 py-0 align-middle border-primary/30 text-primary">
                        You
                      </Badge>
                    )}
                    {member.is_president && (
                      <Badge variant="outline" className="ml-1.5 text-[10px] px-1.5 py-0 align-middle">
                        President
                      </Badge>
                    )}
                  </p>
                  <p
                    className={`text-sm font-semibold ${
                      balance <= 0
                        ? "text-red-600"
                        : balance < 50
                          ? "text-amber-500"
                          : "text-green-600"
                    }`}
                  >
                    {balance <= 0 ? (
                      <TrendingDown className="inline h-3 w-3 mr-0.5" />
                    ) : (
                      <TrendingUp className="inline h-3 w-3 mr-0.5" />
                    )}
                    ₱{balance.toFixed(2)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
