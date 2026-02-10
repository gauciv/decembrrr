import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { AppError, ErrorCode, resolveError } from "@/lib/errors";

interface Profile {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  is_president: boolean;
  class_id: string | null;
  balance: number;
  is_active: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: AppError | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  async function fetchProfile(userId: string) {
    try {
      const { data, error: fetchErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (fetchErr) {
        console.error(`[${ErrorCode.AUTH_PROFILE_NOT_FOUND}] Profile fetch failed:`, fetchErr.message);
        setError(new AppError(ErrorCode.AUTH_PROFILE_NOT_FOUND, fetchErr.message));
        setProfile(null);
        return;
      }

      // Sync Google metadata (avatar, name) on each login
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        const meta = currentUser.user_metadata;
        const googleName = meta?.full_name || meta?.name;
        const googleAvatar = meta?.avatar_url || meta?.picture;
        const updates: Record<string, string> = {};
        if (googleAvatar && googleAvatar !== data.avatar_url) updates.avatar_url = googleAvatar;
        if (googleName && googleName !== data.name) updates.name = googleName;
        if (Object.keys(updates).length > 0) {
          await supabase.from("profiles").update(updates).eq("id", userId);
          Object.assign(data, updates);
        }
      }

      setProfile(data);
      setError(null);
    } catch (err) {
      const appErr = resolveError(err);
      console.error(`[${appErr.code}] Profile fetch error:`, appErr.message);
      setError(appErr);
      setProfile(null);
    }
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id);
  }

  useEffect(() => {
    let initialLoad = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      // Only set loading false after profile is fully loaded
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // Skip the initial SIGNED_IN event since getSession already handles it
      if (initialLoad) {
        initialLoad = false;
        return;
      }
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signInWithGoogle() {
    try {
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (oauthErr) throw oauthErr;
    } catch (err) {
      const appErr = resolveError(err);
      console.error(`[${appErr.code}] Google sign-in failed:`, appErr.message);
      setError(appErr);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setError(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        error,
        signInWithGoogle,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export type { Profile };
