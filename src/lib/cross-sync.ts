/**
 * Cross-sync between Daily Routine (localStorage) and Habits/Avoid (DB).
 * Matching is by case-insensitive name == routine title.
 */
import { todayKey } from "./storage";

const ROUTINE_KEY = "lifeos:routine";

type RoutineItem = { id: string; title: string };
type RoutineState = {
  items: RoutineItem[];
  completion: Record<string, Record<string, boolean>>;
};

const norm = (s: string) => s.trim().toLowerCase().replace(/^no\s+/, "");

/** Update routine localStorage when a habit toggle happens (today only). */
export function mirrorHabitToRoutine(
  habitName: string,
  done: boolean,
  date: string,
) {
  if (typeof window === "undefined") return;
  if (date !== todayKey()) return;
  try {
    const raw = localStorage.getItem(ROUTINE_KEY);
    if (!raw) return;
    const s: RoutineState = JSON.parse(raw);
    const n = norm(habitName);
    const item = s.items?.find((i) => norm(i.title) === n);
    if (!item) return;
    s.completion ??= {};
    s.completion[date] ??= {};
    if (done) s.completion[date][item.id] = true;
    else delete s.completion[date][item.id];
    localStorage.setItem(ROUTINE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** Find a habit whose name matches the routine item title. */
export function findHabitByTitle<T extends { name: string }>(
  habits: T[],
  title: string,
): T | undefined {
  const n = norm(title);
  return habits.find((h) => norm(h.name) === n);
}
