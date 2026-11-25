import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useMemo, useState } from "react";

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

  // Complete Supabase email-confirmation redirects and persist the returned session.
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken) return;
    try {
      localStorage.setItem(TOKEN_KEY, accessToken);
      if (refreshToken) localStorage.setItem("jarvis-supabase-refresh-token", refreshToken);
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    } catch {}
    setSessionVersion(v => v + 1);
    void utils.auth.me.invalidate();
    void utils.auth.me.refetch();
  }, [utils]);

  // Refresh Supabase sessions before their short-lived access token expires.
  useEffect(() => {
    const refresh = async () => {
      const { url, key } = config();
      if (!url || !key) return;
      let refreshToken = "";
      try { refreshToken = localStorage.getItem("jarvis-supabase-refresh-token") ?? ""; } catch {}
      if (!refreshToken) return;
      try {
        const response = await fetch(url + "/auth/v1/token?grant_type=refresh_token", { method: "POST", headers: { "Content-Type": "application/json", apikey: key }, body: JSON.stringify({ refresh_token: refreshToken }) });
        if (!response.ok) return;
        const data = await response.json();
        if (data.access_token) {
          localStorage.setItem(TOKEN_KEY, data.access_token);
          if (data.refresh_token) localStorage.setItem("jarvis-supabase-refresh-token", data.refresh_token);
          setSessionVersion(v => v + 1);
          await utils.auth.me.invalidate();
        }
      } catch { /* Keep the current session; the next API request will report expiry if needed. */ }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 45 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [utils]);

  const authenticate = useCallback(async (mode: "login" | "signup", email: string, password: string) => {
    const { url, key } = config();
    if (!url || !key) throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the Vercel project.");
    const endpoint = mode === "login" ? "/auth/v1/token?grant_type=password" : "/auth/v1/signup";
    const response = await fetch(url + endpoint, { method: "POST", headers: { "Content-Type": "application/json", apikey: key }, body: JSON.stringify({ email: email.trim(), password }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.msg || data.message || data.error_description || "Authentication failed. Check your details and try again.");
    if (!data.access_token) return "Account created. Check your email to confirm it, then sign in.";
    try {
      localStorage.setItem(TOKEN_KEY, data.access_token);
      if (data.refresh_token) localStorage.setItem("jarvis-supabase-refresh-token", data.refresh_token);
    } catch {
      throw new Error("Your browser could not save the secure session. Please allow site storage and try again.");
    }

    // A Supabase token alone is not enough: the J.A.R.V.I.S API must verify it
    // and return the application user before the UI can leave the sign-in screen.
    setSessionVersion(v => v + 1);
    const sessionCheck = await meQuery.refetch();
    if (sessionCheck.error || !sessionCheck.data) {
      try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem("jarvis-supabase-refresh-token");
      } catch {}
      setSessionVersion(v => v + 1);
      const detail = sessionCheck.error instanceof Error ? sessionCheck.error.message : "";
      throw new Error(detail
        ? `Supabase accepted the credentials, but J.A.R.V.I.S could not verify your session: ${detail}`
        : "Supabase accepted the credentials, but J.A.R.V.I.S could not verify your session. Please try again; if it continues, the server-side account setup needs repair.");
    }
    return "Signed in successfully.";
  }, [meQuery.refetch]);

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