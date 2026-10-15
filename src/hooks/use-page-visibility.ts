import { useState, useEffect, useCallback } from "react";
import {
  loadPagePrefs,
  savePagePrefs,
  getCurrentUserId,
  ALL_PAGES,
  type PageKey,
} from "@/features/page-visibility";

export function usePageVisibility() {
  const [userId, setUserId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<Set<PageKey> | null>(null); // null = loading

  useEffect(() => {
    getCurrentUserId().then((id) => {
      setUserId(id);
      if (id) {
        const prefs = loadPagePrefs(id);
        // null means onboarding not done yet — keep null so consumers know
        setEnabled(prefs);
      }
    });
  }, []);

  const update = useCallback(
    (keys: Set<PageKey>) => {
      if (!userId) return;
      savePagePrefs(userId, keys);
      setEnabled(new Set([...keys]));
    },
    [userId],
  );

  const isEnabled = useCallback(
    (key: PageKey) => {
      if (!enabled) return true; // while loading, show everything
      return enabled.has(key);
    },
    [enabled],
  );

  return { enabled, isEnabled, update, userId, loading: enabled === null && userId !== null };
}
