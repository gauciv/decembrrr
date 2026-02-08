import { useState } from "react";
import { useAuth } from "@/context/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClass, joinClass } from "@/lib/api";

export default function OnboardingPage() {
  const { refreshProfile, signOut } = useAuth();
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [className, setClassName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!className.trim()) return;
    setLoading(true);
    setError("");
    try {
      await createClass(className.trim());
      await refreshProfile();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create class");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!inviteCode.trim()) return;
    setLoading(true);
    setError("");
    try {
      await joinClass(inviteCode.trim());
      await refreshProfile();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid invite code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-gradient-to-br from-red-50 to-green-50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="text-4xl mb-2">🎄</div>
          <CardTitle>Welcome to Decembrrr</CardTitle>
          <CardDescription>
            {mode === "choose" && "Create a new class fund or join one"}
            {mode === "create" && "Set up your class fund"}
            {mode === "join" && "Enter the invite code from your president"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          {mode === "choose" && (
            <>
              <Button
                className="w-full"
                size="lg"
                onClick={() => setMode("create")}
              >
                I'm the President — Create Class
              </Button>
              <Button
                className="w-full"
                size="lg"
                variant="outline"
                onClick={() => setMode("join")}
              >
                I have an invite code — Join
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={signOut}
              >
                Sign out
              </Button>
            </>
          )}

          {mode === "create" && (
            <>
              <Input
                placeholder="e.g. BSCS 4A"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <p className="text-xs text-muted-foreground">
                Daily amount: ₱10.00 (default)
              </p>
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={loading || !className.trim()}
              >
                {loading ? "Creating…" : "Create Class"}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setMode("choose")}
              >
                Back
              </Button>
            </>
          )}

          {mode === "join" && (
            <>
              <Input
                placeholder="e.g. A1B2C3D4"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                className="text-center tracking-widest font-mono text-lg"
                maxLength={8}
              />
              <Button
                className="w-full"
                onClick={handleJoin}
                disabled={loading || !inviteCode.trim()}
              >
                {loading ? "Joining…" : "Join Class"}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setMode("choose")}
              >
                Back
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
