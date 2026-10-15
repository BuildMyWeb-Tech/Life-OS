import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALL_PAGES, type PageKey, getCurrentUserId, savePagePrefs } from "@/features/page-visibility";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  component: OnboardingPage,
});

// Pages pre-selected by default
const DEFAULT_SELECTED: PageKey[] = [
  "dashboard", "routine", "work", "tasks", "notes", "habits", "negative-habits",
];

function OnboardingPage() {
  const nav = useNavigate();
  const [selected, setSelected] = useState<Set<PageKey>>(new Set(DEFAULT_SELECTED));
  const [saving, setSaving] = useState(false);

  const toggle = (key: PageKey) => {
    if (key === "dashboard") return; // always on
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(ALL_PAGES.map((p) => p.key)));
  const selectNone = () => setSelected(new Set<PageKey>(["dashboard"]));

  const save = async () => {
    setSaving(true);
    const userId = await getCurrentUserId();
    if (userId) savePagePrefs(userId, selected);
    nav({ to: "/dashboard" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="glass w-full max-w-xl rounded-3xl p-8"
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--gradient-primary)] shadow-[var(--shadow-glow)]">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Set up your LifeOS</h1>
            <p className="text-xs text-muted-foreground">Pick the pages you want to use</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-5">
          You can always change this later from <span className="text-foreground font-medium">Settings</span>.
        </p>

        {/* Quick actions */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={selectAll}
            className="text-xs text-primary hover:underline"
          >
            Select all
          </button>
          <span className="text-muted-foreground text-xs">·</span>
          <button
            onClick={selectNone}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Clear all
          </button>
        </div>

        {/* Page grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
          {ALL_PAGES.map((page) => {
            const on = selected.has(page.key);
            const locked = page.key === "dashboard";
            return (
              <button
                key={page.key}
                onClick={() => toggle(page.key)}
                disabled={locked}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3 text-left transition-all",
                  on
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background/40 opacity-60 hover:opacity-100",
                  locked && "cursor-not-allowed opacity-100",
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors",
                    on ? "bg-primary border-primary" : "border-muted-foreground/40",
                  )}
                >
                  {on && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                </div>
                <div>
                  <p className="text-sm font-medium leading-snug">{page.label}</p>
                  <p className="text-[11px] text-muted-foreground">{page.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        <Button
          className="w-full"
          size="lg"
          disabled={saving || selected.size === 0}
          onClick={save}
        >
          {saving ? "Saving…" : `Continue with ${selected.size} page${selected.size !== 1 ? "s" : ""}`}
        </Button>
      </motion.div>
    </div>
  );
}
