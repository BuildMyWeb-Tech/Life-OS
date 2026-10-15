/**
 * Per-user page visibility preferences stored in localStorage.
 * Key: lifeos:pages:<userId>
 * Value: comma-separated list of enabled page keys, or "ALL" for first-time / no preference set.
 */

import { supabase } from "@/integrations/supabase/client";

export const ALL_PAGES = [
  { key: "dashboard",       label: "Dashboard",       description: "Daily stats and progress overview" },
  { key: "routine",         label: "Daily Routine",   description: "Your daily checklist and habits" },
  { key: "work",            label: "Work & Projects", description: "Hierarchical task and project tracker" },
  { key: "client-calls",    label: "Client Calls",    description: "Log and review client calls" },
  { key: "client-leads",    label: "Client Leads",    description: "Track leads and sales pipeline" },
  { key: "asks",            label: "Asks",            description: "Requests to and from other people" },
  { key: "tasks",           label: "To Do List",      description: "Simple personal task list" },
  { key: "notes",           label: "Notes",           description: "Freeform notes and ideas" },
  { key: "habits",          label: "Habits",          description: "Build positive habits and streaks" },
  { key: "negative-habits", label: "Avoid List",      description: "Track bad habits you want to avoid" },
  { key: "vision-board",    label: "Vision Board",    description: "Goals and visual inspiration" },
  { key: "report",          label: "Report",          description: "Analytics and progress charts" },
  { key: "calendar",        label: "Calendar",        description: "Calendar view of tasks and events" },
  { key: "categories",      label: "Categories",      description: "Organise items with tags" },
] as const;

export type PageKey = (typeof ALL_PAGES)[number]["key"];

// Dashboard is always visible — it's the home page.
const ALWAYS_ON: PageKey[] = ["dashboard"];

function storageKey(userId: string) {
  return `lifeos:pages:${userId}`;
}

export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Returns null when the user has never set preferences (triggers onboarding). */
export function loadPagePrefs(userId: string): Set<PageKey> | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (raw === null) return null; // never set → onboarding
    if (raw === "ALL") return new Set(ALL_PAGES.map((p) => p.key));
    const keys = raw.split(",").filter(Boolean) as PageKey[];
    // Always include ALWAYS_ON pages
    return new Set([...ALWAYS_ON, ...keys]);
  } catch {
    return null;
  }
}

export function savePagePrefs(userId: string, keys: Set<PageKey>) {
  try {
    // Always persist ALWAYS_ON pages
    const toSave = new Set([...ALWAYS_ON, ...keys]);
    localStorage.setItem(storageKey(userId), [...toSave].join(","));
  } catch {}
}

/** Call after registration to mark that prefs are pending (triggers onboarding). */
export function markPrefsPending(userId: string) {
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {}
}
