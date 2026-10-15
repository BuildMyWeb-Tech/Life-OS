import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui-bits";
import {
  ALL_PAGES,
  type PageKey,
  getCurrentUserId,
  savePagePrefs,
  loadPagePrefs,
} from "@/features/page-visibility";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  ssr: false,
  component: SettingsPage,
});

function SettingsPage() {
  const [selected, setSelected] = useState<Set<PageKey>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCurrentUserId().then((id) => {
      setUserId(id);
      if (id) {
        const prefs = loadPagePrefs(id);
        if (prefs) setSelected(prefs);
        else setSelected(new Set(ALL_PAGES.map((p) => p.key)));
      }
    });
  }, []);

  const toggle = (key: PageKey) => {
    if (key === "dashboard") return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(ALL_PAGES.map((p) => p.key)));
  const selectNone = () => setSelected(new Set<PageKey>(["dashboard"]));

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    savePagePrefs(userId, selected);
    setSaving(false);
    toast.success("Page preferences saved");
    // Reload so the sidebar re-renders with the new prefs
    window.location.reload();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader
        title="Settings"
        subtitle="Choose which pages appear in your navigation."
      />

      <div className="glass rounded-2xl p-6 max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Visible Pages</h2>
          <div className="flex gap-3 text-xs">
            <button onClick={selectAll} className="text-primary hover:underline">
              Select all
            </button>
            <span className="text-muted-foreground">·</span>
            <button onClick={selectNone} className="text-muted-foreground hover:text-foreground hover:underline">
              Clear all
            </button>
          </div>
        </div>

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
                  <p className="text-sm font-medium leading-snug">
                    {page.label}
                    {locked && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground uppercase tracking-wide">
                        always on
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{page.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </motion.div>
  );
}
