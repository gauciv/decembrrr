import { NavLink, Outlet } from "react-router-dom";
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

const navItems = [
  { to: "/", label: "Home", icon: "🏠" },
  { to: "/fund", label: "Fund", icon: "💰" },
  { to: "/payments", label: "Pay", icon: "💵", presidentOnly: true },
  { to: "/calendar", label: "Calendar", icon: "📅" },
];

export default function AppLayout() {
  const { profile, signOut } = useAuth();
  if (!profile) return null;

  const visibleNav = navItems.filter(
    (item) => !item.presidentOnly || profile.role === "president"
  );

  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between px-4">
          <span className="text-lg font-bold">🎄 Decembrrr</span>
          <Sheet>
            <SheetTrigger asChild>
              <button className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback>
                    {profile.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
              </button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Account</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback>
                      {profile.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{profile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {profile.email}
                    </p>
                  </div>
                </div>
                <Separator />
                <p className="text-sm">
                  <span className="text-muted-foreground">Role:</span>{" "}
                  <span className="capitalize">{profile.role}</span>
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Balance:</span>{" "}
                  <span
                    className={
                      profile.balance >= 0 ? "text-green-600" : "text-red-600"
                    }
                  >
                    ₱{profile.balance.toFixed(2)}
                  </span>
                </p>
                <Separator />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={signOut}
                >
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
          {visibleNav.map((item) => (
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
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
