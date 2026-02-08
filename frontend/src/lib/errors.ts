/**
 * Error code constants grouped by domain.
 * Pattern: ERR_{category}{sequence}
 *   1xxx = Config/Env, 2xxx = Auth, 3xxx = Class,
 *   4xxx = Payment, 5xxx = Calendar, 9xxx = Generic
 */
export const ErrorCode = {
  // ENV / Config (1xxx)
  SUPABASE_URL_MISSING: "ERR_1001",
  SUPABASE_KEY_MISSING: "ERR_1002",
  SUPABASE_UNREACHABLE: "ERR_1003",

  // Auth (2xxx)
  AUTH_NOT_AUTHENTICATED: "ERR_2001",
  AUTH_SESSION_EXPIRED: "ERR_2002",
  AUTH_GOOGLE_FAILED: "ERR_2003",
  AUTH_PROFILE_NOT_FOUND: "ERR_2004",

  // Class (3xxx)
  CLASS_NOT_FOUND: "ERR_3001",
  CLASS_INVITE_INVALID: "ERR_3002",
  CLASS_ALREADY_MEMBER: "ERR_3003",
  CLASS_CREATE_FAILED: "ERR_3004",

  // Payment (4xxx)
  PAYMENT_STUDENT_NOT_FOUND: "ERR_4001",
  PAYMENT_INVALID_AMOUNT: "ERR_4002",
  PAYMENT_RECORD_FAILED: "ERR_4003",
  PAYMENT_NOT_PRESIDENT: "ERR_4004",

  // Calendar (5xxx)
  CALENDAR_DATE_EXISTS: "ERR_5001",
  CALENDAR_SAVE_FAILED: "ERR_5002",

  // Generic (9xxx)
  NETWORK_ERROR: "ERR_9001",
  UNKNOWN: "ERR_9999",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * User-facing error messages — written for students & presidents, not devs.
 * Developer context is surfaced via the `detail` field and console logs.
 */
const messages: Record<ErrorCode, string> = {
  // Config — these only appear during development / first deploy
  [ErrorCode.SUPABASE_URL_MISSING]:
    "The app isn't set up yet. Please contact your administrator.",
  [ErrorCode.SUPABASE_KEY_MISSING]:
    "The app isn't set up yet. Please contact your administrator.",
  [ErrorCode.SUPABASE_UNREACHABLE]:
    "We can't reach our servers right now. Please check your internet connection and try again.",

  // Auth
  [ErrorCode.AUTH_NOT_AUTHENTICATED]:
    "You need to sign in first before doing that.",
  [ErrorCode.AUTH_SESSION_EXPIRED]:
    "Your session has expired. Please sign in again to continue.",
  [ErrorCode.AUTH_GOOGLE_FAILED]:
    "Google sign-in didn't go through. Please try again — if it keeps failing, contact your administrator.",
  [ErrorCode.AUTH_PROFILE_NOT_FOUND]:
    "We couldn't find your profile. Try signing out and back in. If this persists, contact your administrator.",

  // Class
  [ErrorCode.CLASS_NOT_FOUND]:
    "This class doesn't exist or may have been removed.",
  [ErrorCode.CLASS_INVITE_INVALID]:
    "That invite code didn't work. Double-check the code from your class president and try again.",
  [ErrorCode.CLASS_ALREADY_MEMBER]:
    "You're already part of a class. You need to leave your current class first.",
  [ErrorCode.CLASS_CREATE_FAILED]:
    "We couldn't create the class right now. Please try again in a moment.",

  // Payment
  [ErrorCode.PAYMENT_STUDENT_NOT_FOUND]:
    "We couldn't find that student. They may no longer be in your class.",
  [ErrorCode.PAYMENT_INVALID_AMOUNT]:
    "Please enter a valid payment amount greater than zero.",
  [ErrorCode.PAYMENT_RECORD_FAILED]:
    "The payment couldn't be saved. Please try again — if it keeps failing, contact your administrator.",
  [ErrorCode.PAYMENT_NOT_PRESIDENT]:
    "Only the class president can record payments.",

  // Calendar
  [ErrorCode.CALENDAR_DATE_EXISTS]:
    "That date is already marked as a no-class day.",
  [ErrorCode.CALENDAR_SAVE_FAILED]:
    "We couldn't save that date. Please try again.",

  // Generic
  [ErrorCode.NETWORK_ERROR]:
    "You seem to be offline. Check your internet connection and try again.",
  [ErrorCode.UNKNOWN]:
    "Something went wrong. Please try again — if it keeps happening, contact your administrator.",
};

export class AppError extends Error {
  code: ErrorCode;
  detail?: string;

  constructor(code: ErrorCode, detail?: string) {
    const base = messages[code] ?? messages[ErrorCode.UNKNOWN];
    super(detail ? `${base} (${detail})` : base);
    this.code = code;
    this.detail = detail;
    this.name = "AppError";
  }
}

export function resolveError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  const msg =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";

  // Supabase PostgREST / Auth errors
  if (msg.includes("JWT expired") || msg.includes("token is expired"))
    return new AppError(ErrorCode.AUTH_SESSION_EXPIRED);
  if (msg.includes("Invalid login credentials"))
    return new AppError(ErrorCode.AUTH_GOOGLE_FAILED);
  if (msg.includes("FetchError") || msg.includes("Failed to fetch"))
    return new AppError(ErrorCode.NETWORK_ERROR);
  if (msg.includes("duplicate key") && msg.includes("no_class_dates"))
    return new AppError(ErrorCode.CALENDAR_DATE_EXISTS);
  if (msg.includes("violates row-level security"))
    return new AppError(ErrorCode.PAYMENT_RECORD_FAILED, "RLS policy denied the operation");

  return new AppError(ErrorCode.UNKNOWN, msg || undefined);
}

export function getErrorMessage(err: unknown): string {
  return resolveError(err).message;
}
