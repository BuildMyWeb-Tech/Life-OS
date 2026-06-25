/**
 * Helpers for matching habits <-> routine items by title.
 */
const norm = (s: string) => s.trim().toLowerCase().replace(/^no\s+/, "");

export function findHabitByTitle<T extends { name: string }>(
  habits: T[],
  title: string,
): T | undefined {
  const n = norm(title);
  return habits.find((h) => norm(h.name) === n);
}

export function findRoutineByName<T extends { title: string }>(
  items: T[],
  name: string,
): T | undefined {
  const n = norm(name);
  return items.find((i) => norm(i.title) === n);
}
