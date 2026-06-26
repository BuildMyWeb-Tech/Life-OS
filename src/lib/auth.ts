import { supabase } from "@/integrations/supabase/client";
import { ensureAdminAccount } from "./admin-auth.functions";

const KEY = "lifeos:auth";
const USER = (import.meta.env.VITE_ADMIN_USERNAME as string) || "admin";
const PASS = (import.meta.env.VITE_ADMIN_PASSWORD as string) || "admin@2026";

/** Ensure we have a stable backend session so RLS-scoped queries work. */
export async function ensureSupabaseSession() {
  if (typeof window === "undefined") return false;
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

export async function login(username: string, password: string) {
  if (username !== USER || password !== PASS) return false;
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
