import { supabase } from "@/integrations/supabase/client";

const KEY = "lifeos:auth";
const USER = (import.meta.env.VITE_ADMIN_USERNAME as string) || "admin";
const PASS = (import.meta.env.VITE_ADMIN_PASSWORD as string) || "admin@2026";

/** Ensure we have a Supabase session so RLS-scoped queries work. */
export async function ensureSupabaseSession() {
  if (typeof window === "undefined") return;
  const { data } = await supabase.auth.getSession();
  if (data.session) return;
  await supabase.auth.signInAnonymously();
}

export async function login(username: string, password: string) {
  if (username !== USER || password !== PASS) return false;
  if (typeof window !== "undefined") localStorage.setItem(KEY, "1");
  await ensureSupabaseSession();
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
