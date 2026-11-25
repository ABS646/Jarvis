import { trpc } from "@/lib/trpc";
import { useCallback, useMemo, useState } from "react";

type UseAuthOptions = { redirectOnUnauthenticated?: boolean; redirectPath?: string };
const TOKEN_KEY = "jarvis-supabase-access-token";

function config() {
  return {
    url: (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, ""),
    key: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  };
}

export function useAuth(_options?: UseAuthOptions) {
  const utils = trpc.useUtils();
  const [sessionVersion, setSessionVersion] = useState(0);
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });

  const authenticate = useCallback(async (mode: "login" | "signup", email: string, password: string) => {
    const { url, key } = config();
    if (!url || !key) throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the Vercel project.");
    const endpoint = mode === "login" ? "/auth/v1/token?grant_type=password" : "/auth/v1/signup";
    const response = await fetch(url + endpoint, { method: "POST", headers: { "Content-Type": "application/json", apikey: key }, body: JSON.stringify({ email: email.trim(), password }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.msg || data.message || data.error_description || "Authentication failed. Check your details and try again.");
    if (!data.access_token) return "Account created. Check your email to confirm it, then sign in.";
    try { localStorage.setItem(TOKEN_KEY, data.access_token); if (data.refresh_token) localStorage.setItem("jarvis-supabase-refresh-token", data.refresh_token); } catch {}
    setSessionVersion(v => v + 1);
    await utils.auth.me.invalidate();
    await utils.auth.me.refetch();
    return "Signed in successfully.";
  }, [utils]);

  const signIn = useCallback((email: string, password: string) => authenticate("login", email, password), [authenticate]);
  const signUp = useCallback((email: string, password: string) => authenticate("signup", email, password), [authenticate]);

  const logout = useCallback(async () => {
    const { url, key } = config();
    let token = "";
    try { token = localStorage.getItem(TOKEN_KEY) ?? ""; } catch {}
    if (url && key && token) { try { await fetch(url + "/auth/v1/logout", { method: "POST", headers: { apikey: key, Authorization: "Bearer " + token } }); } catch {} }
    try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem("jarvis-supabase-refresh-token"); } catch {}
    setSessionVersion(v => v + 1);
    utils.auth.me.setData(undefined, null);
    await utils.auth.me.invalidate();
  }, [utils]);

  const state = useMemo(() => ({ user: meQuery.data ?? null, loading: meQuery.isLoading, error: meQuery.error ?? null, isAuthenticated: Boolean(meQuery.data) }), [meQuery.data, meQuery.error, meQuery.isLoading, sessionVersion]);
  return { ...state, refresh: () => meQuery.refetch(), logout, signIn, signUp };
}