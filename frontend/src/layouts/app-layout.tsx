import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  Wallet,
  HandCoins,
  CalendarOff,
  LogOut,
  Copy,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { getMyClass, type ClassData } from "@/lib/api";
import { useEffect } from "react";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  presidentOnly?: boolean;
}

const navItems: NavItem[] = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/fund", label: "Fund", icon: Wallet },
  { to: "/payments", label: "Collect", icon: HandCoins, presidentOnly: true },
  { to: "/calendar", label: "Exempt", icon: CalendarOff },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
}

export default function AppLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (profile?.class_id) {
      getMyClass(profile.class_id).then(setClassData);
    }
  }, [profile?.class_id]);

  if (!profile) return null;

  const visibleNav = navItems.filter(
    (item) => !item.presidentOnly || profile.role === "president"
  );

  function copyInviteCode() {
    if (!classData?.invite_code) return;
    navigator.clipboard.writeText(classData.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight">Decembrrr</span>
            {classData && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {classData.name}
              </span>
            )}
          </div>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button className="rounded-full ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {initials(profile.name)}
                  </AvatarFallback>
                </Avatar>
              </button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Account</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-5">
                {/* Profile card */}
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback>{initials(profile.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{profile.name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {profile.email}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Class info */}
                {classData && (
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Class
                    </p>
                    <div className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {classData.name}
                        </span>
                        <span className="text-xs capitalize bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          {profile.role}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          ₱{classData.daily_amount}/{classData.collection_frequency === "weekly" ? "week" : "day"}
                        </span>
                        {classData.fund_goal && (
                          <span className="text-muted-foreground">
                            Goal: ₱{classData.fund_goal.toLocaleString()}
                          </span>
                        )}
                      </div>
                      {/* Invite code */}
                      <button
                        onClick={copyInviteCode}
                        className="flex w-full items-center justify-between rounded-md bg-muted p-2 text-sm hover:bg-muted/80 transition-colors"
                      >
                        <span className="font-mono tracking-widest">
                          {classData.invite_code}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          {copied ? "Copied!" : <><Copy className="h-3 w-3" /> Copy</>}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Quick links */}
                {profile.role === "president" && (
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        setSheetOpen(false);
                        navigate("/calendar");
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm hover:bg-accent transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <CalendarOff className="h-4 w-4 text-muted-foreground" />
                        Manage Exemptions
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                )}

                <Separator />

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={signOut}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 pb-20">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/80 backdrop-blur-sm">
        <div className="flex h-16 items-center justify-around">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors ${
                    isActive
                      ? "text-foreground font-medium"
                      : "text-muted-foreground"
                  }`
                }
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
