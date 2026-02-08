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
import { getErrorMessage } from "@/lib/errors";

export default function OnboardingPage() {
  const { refreshProfile, signOut } = useAuth();
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");

  // Create form state
  const [className, setClassName] = useState("");
  const [dailyAmount, setDailyAmount] = useState("10");
  const [fundGoal, setFundGoal] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");

  // Join form state
  const [inviteCode, setInviteCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!className.trim()) return;
    setLoading(true);
    setError("");
    try {
      await createClass({
        name: className.trim(),
        dailyAmount: parseFloat(dailyAmount) || 10,
        fundGoal: fundGoal ? parseFloat(fundGoal) : null,
        collectionFrequency: frequency,
      });
      await refreshProfile();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
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
      setError(getErrorMessage(err));
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
            {mode === "choose" && "Get started with your class fund"}
            {mode === "create" && "Set up your class fund"}
            {mode === "join" && "Enter the code from your class president"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          {/* --- Choose mode --- */}
          {mode === "choose" && (
            <>
              <Button
                className="w-full"
                size="lg"
                onClick={() => setMode("create")}
              >
                Create a Class
              </Button>
              <Button
                className="w-full"
                size="lg"
                variant="outline"
                onClick={() => setMode("join")}
              >
                Join with Invite Code
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground text-sm"
                onClick={signOut}
              >
                Sign out
              </Button>
            </>
          )}

          {/* --- Create class form --- */}
          {mode === "create" && (
            <>
              {/* Class name */}
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="class-name">
                  Class Name
                </label>
                <Input
                  id="class-name"
                  placeholder="e.g. BSCS 4A"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                />
              </div>

              {/* Amount + Frequency row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="amount">
                    Amount (₱)
                  </label>
                  <Input
                    id="amount"
                    type="number"
                    min="1"
                    step="0.50"
                    placeholder="10.00"
                    value={dailyAmount}
                    onChange={(e) => setDailyAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="frequency">
                    Frequency
                  </label>
                  <select
                    id="frequency"
                    value={frequency}
                    onChange={(e) =>
                      setFrequency(e.target.value as "daily" | "weekly")
                    }
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>

              {/* Fund goal — optional */}
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="goal">
                  Fund Goal (₱)
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    — optional
                  </span>
                </label>
                <Input
                  id="goal"
                  type="number"
                  min="0"
                  step="100"
                  placeholder="e.g. 5000"
                  value={fundGoal}
                  onChange={(e) => setFundGoal(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  You can change all of these later in settings.
                </p>
              </div>

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
                onClick={() => {
                  setMode("choose");
                  setError("");
                }}
              >
                Back
              </Button>
            </>
          )}

          {/* --- Join class form --- */}
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
                onClick={() => {
                  setMode("choose");
                  setError("");
                }}
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
