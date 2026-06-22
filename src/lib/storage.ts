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

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
