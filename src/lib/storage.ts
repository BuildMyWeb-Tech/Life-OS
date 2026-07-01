import { useEffect, useState, useCallback } from "react";

export function useLocal<T>(key: string, initial: T) {
  const [val, setVal] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setVal(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {}
  }, [key, val, hydrated]);

  const update = useCallback((updater: T | ((prev: T) => T)) => {
    setVal((prev) =>
      typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater,
    );
  }, []);

  return [val, update, hydrated] as const;
}

function fmt(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayKey() {
  return logicalTodayKey();
}

export function daysAgo(n: number) {
  const d = new Date();
  if (d.getHours() < 4 || (d.getHours() === 4 && d.getMinutes() < 30)) {
    d.setDate(d.getDate() - 1);
  }
  d.setDate(d.getDate() - n);
  return fmt(d);
}

/**
 * Logical "today" — a day starts at 04:30 local time.
 * If it's before 04:30, we're still on the previous calendar day.
 */
export function logicalTodayKey() {
  const d = new Date();
  if (d.getHours() < 4 || (d.getHours() === 4 && d.getMinutes() < 30)) {
    d.setDate(d.getDate() - 1);
  }
  return fmt(d);
}

export function prettyDate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
