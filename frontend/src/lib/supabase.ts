import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppError, ErrorCode } from "@/lib/errors";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function validateConfig(): { url: string; key: string } {
  const missing: ErrorCode[] = [];

  if (!url || url === "https://YOUR_PROJECT.supabase.co")
    missing.push(ErrorCode.SUPABASE_URL_MISSING);
  if (!key || key === "YOUR_ANON_KEY")
    missing.push(ErrorCode.SUPABASE_KEY_MISSING);

  if (missing.length > 0) throw new AppError(missing[0]);

  return { url: url!, key: key! };
}

export type ConfigStatus =
  | { ok: true }
  | { ok: false; error: AppError };

export function checkSupabaseConfig(): ConfigStatus {
  try {
    validateConfig();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err as AppError };
  }
}

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;
  const cfg = validateConfig();
  _supabase = createClient(cfg.url, cfg.key);
  return _supabase;
}

export async function checkSupabaseConnection(): Promise<ConfigStatus> {
  const cfgCheck = checkSupabaseConfig();
  if (!cfgCheck.ok) return cfgCheck;

  try {
    const client = getSupabase();
    const { error } = await client.from("classes").select("id").limit(1);
    // Permission denied is fine — it means Supabase is reachable but RLS blocked it
    if (error && !error.message.includes("permission denied") && !error.code?.startsWith("42")) {
      return { ok: false, error: new AppError(ErrorCode.SUPABASE_UNREACHABLE, error.message) };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: new AppError(ErrorCode.SUPABASE_UNREACHABLE) };
  }
}

// Convenience alias used everywhere — lazy-init on first access
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabase(), prop, receiver);
  },
});
