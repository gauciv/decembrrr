import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import {
  LayoutDashboard,
  LogOut,
  Receipt,
  Users,
  Plus,
  BarChart3,
  Wallet,
  ChevronRight,
  Download,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";
import { useState, lazy, Suspense, useCallback, useEffect } from "react";
import { getMyClass, exportTransactionsCsv, type ClassData } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";

const ScanFlow = lazy(() => import("@/components/president/scan-flow"));

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  presidentOnly?: boolean;
  studentOnly?: boolean;
}

const navItems: NavItem[] = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/class-list", label: "Class", icon: Users, presidentOnly: true },
  { to: "/wallet", label: "Wallet", icon: Wallet, presidentOnly: true },
  { to: "/analytics", label: "Stats", icon: BarChart3, presidentOnly: true },
  { to: "/transactions", label: "Log", icon: Receipt, studentOnly: true },
  { to: "/class", label: "Class", icon: Users, studentOnly: true },
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
  const [scanOpen, setScanOpen] = useState(false);
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [toast, setToast] = useState("");

  const loadClass = useCallback(async () => {
    if (!profile?.class_id) return;
    try {
      const c = await getMyClass(profile.class_id);
      setClassData(c);
    } catch { /* ignore */ }
  }, [profile?.class_id]);

  useEffect(() => { loadClass(); }, [loadClass]);

  if (!profile) return null;

  const isPresident = profile.is_president;
  const visibleNav = navItems.filter((item) => {
    if (item.presidentOnly && !isPresident) return false;
    if (item.studentOnly && isPresident) return false;
    return true;
  });

  const presidentLeft = visibleNav.filter(
    (i) => i.to === "/" || i.to === "/class-list"
  );
  const presidentRight = visibleNav.filter(
    (i) => i.to === "/wallet" || i.to === "/analytics"
  );

  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight">Decembrrr</span>
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
                {/* Profile info */}
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback>{initials(profile.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium truncate">{profile.name}</p>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                        {isPresident ? "President" : "Member"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {profile.email}
                    </p>
                  </div>
                </div>

                {/* Class summary */}
                {classData && (
                  <>
                    <Separator />
                    <div className="rounded-lg border p-3 space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Class</p>
                      <p className="text-sm font-semibold">{classData.name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>₱{classData.daily_amount}/day</span>
                        {classData.fund_goal && <span>Goal: ₱{classData.fund_goal.toLocaleString()}</span>}
                        <span>Since {new Date(classData.date_initiated + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</span>
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Quick actions */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Quick Actions</p>

                  {isPresident && (
                    <>
                      <button
                        onClick={() => { setSheetOpen(false); navigate("/calendar"); }}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm hover:bg-accent transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-muted-foreground" />
                          No-Class Dates
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                      <button
                        onClick={async () => {
                          if (!profile.class_id || downloading) return;
                          setDownloading(true);
                          try {
                            await exportTransactionsCsv(profile.class_id);
                            setToast("CSV downloaded");
                            setTimeout(() => setToast(""), 3000);
                          } catch (err) {
                            setToast(getErrorMessage(err));
                            setTimeout(() => setToast(""), 4000);
                          } finally {
                            setDownloading(false);
                          }
                        }}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm hover:bg-accent transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <Download className="h-4 w-4 text-muted-foreground" />
                          {downloading ? "Downloading…" : "Export Transactions"}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </>
                  )}
                </div>

                {toast && (
                  <div className="rounded-md bg-green-50 border border-green-200 p-2 text-xs text-green-700 text-center">
                    {toast}
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
          {isPresident ? (
            <>
              {presidentLeft.map((item) => {
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

              <button
                onClick={() => setScanOpen(true)}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg -mt-5 hover:bg-primary/90 transition-colors"
                aria-label="Scan QR code"
              >
                <Plus className="h-6 w-6" />
              </button>

              {presidentRight.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
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
            </>
          ) : (
            visibleNav.map((item) => {
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
            })
          )}
        </div>
      </nav>

      {isPresident && (
        <Suspense>
          <ScanFlow open={scanOpen} onOpenChange={setScanOpen} />
        </Suspense>
      )}
    </div>
  );
}
