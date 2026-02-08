import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/auth";
import { joinClass } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

/**
 * /join?code=XXXX route — auto-joins the student to a class
 * when they scan a QR code or click a share link from the president.
 */
export default function JoinPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const code = params.get("code");

  useEffect(() => {
    async function autoJoin() {
      if (!code) {
        setStatus("error");
        setErrorMsg("No invite code found in the link.");
        return;
      }

      /* Already in a class — skip joining */
      if (profile?.class_id) {
        setStatus("error");
        setErrorMsg("You're already in a class. Leave your current class first.");
        return;
      }

      /* Not signed in — redirect to login, the code will be preserved in URL */
      if (!user) {
        return;
      }

      try {
        await joinClass(code);
        await refreshProfile();
        setStatus("success");
      } catch (err) {
        setStatus("error");
        setErrorMsg(getErrorMessage(err));
      }
    }

    autoJoin();
  }, [code, user, profile?.class_id]);

  return (
    <div className="flex min-h-svh items-center justify-center bg-gradient-to-br from-red-50 to-green-50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="text-4xl mb-2">🎄</div>
          <CardTitle>Joining Class</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">
                Joining with code <span className="font-mono font-bold">{code}</span>…
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" />
              <p className="text-sm text-green-700 font-medium">
                You've successfully joined the class!
              </p>
              <Button className="w-full" onClick={() => navigate("/")}>
                Go to Dashboard
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="h-10 w-10 text-red-500 mx-auto" />
              <p className="text-sm text-destructive">{errorMsg}</p>
              <Button variant="outline" className="w-full" onClick={() => navigate("/")}>
                Go Back
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
