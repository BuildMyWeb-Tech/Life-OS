import { supabase } from "@/integrations/supabase/client";
import { ensureAdminAccount } from "./admin-auth.functions";
import { registerUser } from "./register.functions";

const KEY = "lifeos:auth";
const USER = (import.meta.env.VITE_ADMIN_USERNAME as string) || "admin";
const PASS = (import.meta.env.VITE_ADMIN_PASSWORD as string) || "admin@2026";

/** Same synthetic-email scheme used by register.functions.ts, so a regular
 * user's username maps to the exact account registerUser created. */
function emailForUsername(username: string) {
  return `${username.toLowerCase().trim()}@user.mylife-monitor.local`;
}

/** Ensure we have a stable backend session so RLS-scoped queries work.
 * getSession() alone can occasionally come back empty right after the app
 * resumes from a long background sleep (mobile browsers throttle timers,
 * so the client's auto-refresh may not have run yet) — before treating that
 * as "logged out", explicitly try to refresh the session once. */
export async function ensureSupabaseSession() {
  if (typeof window === "undefined") return false;
  const { data } = await supabase.auth.getSession();
  if (data.session) return true;

  try {
    const { data: refreshed } = await supabase.auth.refreshSession();
    return !!refreshed.session;
  } catch {
    return false;
  }
}

export async function login(username: string, password: string) {
  // The one special-cased admin login is completely unchanged from before —
  // same env-var credentials, same ensureAdminAccount flow, same account and
  // all of its existing data. This branch is untouched on purpose.
  if (username === USER && password === PASS) {
    const account = await ensureAdminAccount({ data: { username, password } });
    if (!account.ok || !account.email) return false;

    const { error } = await supabase.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });
    if (error) throw error;

    if (typeof window !== "undefined") localStorage.setItem(KEY, "1");
    return true;
  }

  // Any other username is a regular registered user (see register() below).
  // Their data is isolated automatically by row-level security — nothing
  // about the admin account or its data is touched by this path.
  const { error } = await supabase.auth.signInWithPassword({
    email: emailForUsername(username),
    password,
  });
  if (error) return false;

  if (typeof window !== "undefined") localStorage.setItem(KEY, "1");
  return true;
}

/** Create a brand-new account for the given username/password and sign it in.
 * Fully separate from the admin account and from every other user's account
 * — RLS scopes all data by auth.uid(), so a new user starts with an empty
 * workspace and can never see anyone else's rows. */
export async function register(username: string, password: string) {
  const result = await registerUser({ data: { username, password } });
  if (!result.ok) throw new Error(result.error);

  const { error } = await supabase.auth.signInWithPassword({
    email: result.email,
    password,
  });
  if (error) throw error;

  if (typeof window !== "undefined") localStorage.setItem(KEY, "1");
  return true;
}

export async function logout() {
  if (typeof window !== "undefined") localStorage.removeItem(KEY);
  try {
    await supabase.auth.signOut();
  } catch {
    /* ignore */
  }
}

export function isAuthed() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) === "1";
}

export function clearLocalAuth() {
  if (typeof window !== "undefined") localStorage.removeItem(KEY);
}

/**
 * Call once (e.g. from AppShell) for the lifetime of the authenticated app.
 * Two things keep a long-lived session (up to whatever the Supabase project's
 * refresh-token lifetime is set to) from unexpectedly dropping:
 *  1. Whenever the tab/PWA comes back to the foreground, proactively touch
 *     the session — mobile browsers throttle/suspend timers in the
 *     background, so the SDK's own auto-refresh timer can miss its window
 *     while the app is backgrounded for a while.
 *  2. Only clear the local "logged in" flag on a genuine SIGNED_OUT event,
 *     not on a transient network hiccup.
 * Returns an unsubscribe function.
 */
export function attachSessionKeepAlive() {
  if (typeof window === "undefined") return () => {};

  const onVisible = () => {
    if (document.visibilityState === "visible") {
      void ensureSupabaseSession();
    }
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onVisible);

  const { data: sub } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      clearLocalAuth();
    } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      if (typeof window !== "undefined") localStorage.setItem(KEY, "1");
    }
  });

  return () => {
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onVisible);
    sub.subscription.unsubscribe();
  };
}