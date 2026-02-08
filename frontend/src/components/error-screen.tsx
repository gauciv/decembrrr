import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorCode, type AppError } from "@/lib/errors";

/** User-facing tips shown directly on the error screen */
const userTips: Partial<Record<ErrorCode, string[]>> = {
  [ErrorCode.SUPABASE_UNREACHABLE]: [
    "Check if you're connected to the internet",
    "Try refreshing the page in a few seconds",
    "If the problem continues, the service may be temporarily down",
  ],
  [ErrorCode.AUTH_SESSION_EXPIRED]: [
    "Tap the button below to sign in again",
    "Your data is safe — sessions just expire after a while",
  ],
  [ErrorCode.AUTH_GOOGLE_FAILED]: [
    "Make sure you're using the correct Google account",
    "Try clearing your browser cookies and signing in again",
    "If this keeps happening, ask your class president or admin for help",
  ],
  [ErrorCode.AUTH_PROFILE_NOT_FOUND]: [
    "Try signing out and signing back in",
    "If you just created your account, wait a moment and reload",
    "Contact your administrator if this keeps happening",
  ],
  [ErrorCode.CLASS_INVITE_INVALID]: [
    "Invite codes are 8 characters and not case-sensitive",
    "Ask your class president to send the code again",
  ],
  [ErrorCode.NETWORK_ERROR]: [
    "Check your Wi-Fi or mobile data connection",
    "Try moving to an area with better signal",
    "Reload the page once you're back online",
  ],
};

/**
 * Developer-only troubleshooting steps shown behind a collapsible.
 * These reference env vars, Supabase dashboard, and migrations.
 */
const devSteps: Partial<Record<ErrorCode, string[]>> = {
  [ErrorCode.SUPABASE_URL_MISSING]: [
    "Create frontend/.env with VITE_SUPABASE_URL=https://<ref>.supabase.co",
    "Restart the dev server (Vite does not hot-reload env changes)",
  ],
  [ErrorCode.SUPABASE_KEY_MISSING]: [
    "Supabase Dashboard → Settings → API → copy anon/public key",
    "Add VITE_SUPABASE_ANON_KEY=<key> to frontend/.env",
    "Restart the dev server",
  ],
  [ErrorCode.SUPABASE_UNREACHABLE]: [
    "Verify VITE_SUPABASE_URL matches your Supabase project",
    "Check that the Supabase project is not paused",
    "Try opening the URL directly in a browser",
  ],
  [ErrorCode.AUTH_GOOGLE_FAILED]: [
    "Supabase Dashboard → Auth → Providers → Google must be enabled",
    "OAuth Client ID + Secret must match Google Cloud Console",
    "Authorized redirect URI must be: <SUPABASE_URL>/auth/v1/callback",
  ],
  [ErrorCode.AUTH_PROFILE_NOT_FOUND]: [
    "Ensure handle_new_user() trigger exists (002_functions.sql)",
    "Check profiles table schema matches 001_schema.sql",
    "Check Supabase Dashboard → Database → Triggers",
  ],
  [ErrorCode.PAYMENT_RECORD_FAILED]: [
    "Check RLS policies on transactions + profiles tables",
    "Verify the acting user has the 'president' role",
    "Check Supabase logs for the full PostgREST error",
  ],
};

interface ErrorScreenProps {
  error: AppError;
  onRetry?: () => void;
}

export function ErrorScreen({ error, onRetry }: ErrorScreenProps) {
  const tips = userTips[error.code];
  const dev = devSteps[error.code];
  const isConfig = (
    [ErrorCode.SUPABASE_URL_MISSING, ErrorCode.SUPABASE_KEY_MISSING, ErrorCode.SUPABASE_UNREACHABLE] as string[]
  ).includes(error.code);

  return (
    <div className="flex min-h-svh items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="text-4xl mb-2">{isConfig ? "⚙️" : "⚠️"}</div>
          <CardTitle className="text-xl">
            {isConfig ? "Setup Required" : "Something Went Wrong"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Primary user-facing message */}
          <p className="text-sm text-center text-muted-foreground">
            {error.message}
          </p>

          {/* User-friendly tips — always visible */}
          {tips && (
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-sm font-medium mb-2">What you can try:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                {tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {onRetry && (
              <Button className="flex-1" onClick={onRetry}>
                Try Again
              </Button>
            )}
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </Button>
          </div>

          {/* Developer details — collapsed by default */}
          {(error.detail || dev) && (
            <details className="text-xs text-muted-foreground border-t pt-3">
              <summary className="cursor-pointer font-medium">
                Developer info ({error.code})
              </summary>
              <div className="mt-2 space-y-2">
                {error.detail && (
                  <pre className="p-2 bg-muted rounded-md overflow-x-auto whitespace-pre-wrap">
                    {error.detail}
                  </pre>
                )}
                {dev && (
                  <ol className="list-decimal list-inside space-y-1">
                    {dev.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                )}
              </div>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
