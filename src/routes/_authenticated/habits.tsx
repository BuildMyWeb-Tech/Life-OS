import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Flame, Plus, Trash2 } from "lucide-react";
import { PageHeader, StatCard } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocal, todayKey, daysAgo } from "@/lib/storage";
import { DEFAULT_HABITS, type HabitState } from "@/features/habit-types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/habits")({
  ssr: false,
  component: HabitsPage,
});

const newId = () => Math.random().toString(36).slice(2, 10);

function HabitsPage() {
  const [state, setState] = useLocal<HabitState>("lifeos:habits", DEFAULT_HABITS);
  const [name, setName] = useState("");
  const today = todayKey();

  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => daysAgo(13 - i)), []);

  const toggle = (habitId: string, day: string) =>
    setState((s) => ({
      ...s,
      logs: {
        ...s.logs,
        [day]: { ...(s.logs[day] ?? {}), [habitId]: !s.logs[day]?.[habitId] },
      },
    }));

  const add = () => {
    if (!name.trim()) return;
    setState((s) => ({ ...s, items: [...s.items, { id: newId(), name: name.trim(), emoji: "⭐" }] }));
    setName("");
    toast.success("Habit added");
  };

  const remove = (id: string) =>
    setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) }));

  const habitStats = (id: string) => {
    let current = 0, longest = 0, run = 0, completed = 0, total = 0;
    for (let i = 0; i < 90; i++) {
      const d = daysAgo(i);
      total++;
      const done = !!state.logs[d]?.[id];
      if (done) completed++;
      if (done) {
        run++;
        if (i === 0 || current === i) current = run;
        longest = Math.max(longest, run);
      } else {
        if (i === 0) current = 0;
        run = 0;
      }
    }
    return { current, longest, rate: total ? Math.round((completed / total) * 100) : 0 };
  };

  const doneToday = state.items.filter((h) => state.logs[today]?.[h.id]).length;

  const bestHabit = state.items
    .map((h) => ({ h, s: habitStats(h.id) }))
    .sort((a, b) => b.s.rate - a.s.rate)[0];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader title="Habit Tracker" subtitle="Build the system. The system builds you." />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Today" value={`${doneToday}/${state.items.length}`} icon={<Flame className="h-4 w-4" />} />
        <StatCard label="Best Habit" value={bestHabit ? `${bestHabit.s.rate}%` : "—"} hint={bestHabit?.h.name} accent="success" />
        <StatCard label="Total Habits" value={state.items.length} accent="accent" />
      </div>

      <div className="glass mb-4 flex gap-2 rounded-2xl p-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="New habit (e.g. Read 20 pages)" className="bg-transparent" />
        <Button onClick={add} className="gap-2"><Plus className="h-4 w-4" /> Add Habit</Button>
      </div>

      <div className="glass overflow-x-auto rounded-2xl p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="sticky left-0 bg-transparent px-2 py-2">Habit</th>
              {days.map((d) => (
                <th key={d} className="px-1 py-2 text-center">{d.slice(8)}</th>
              ))}
              <th className="px-2 py-2 text-right">Streak</th>
              <th className="px-2 py-2 text-right">Rate</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {state.items.map((h) => {
              const s = habitStats(h.id);
              return (
                <tr key={h.id} className="border-t border-border">
                  <td className="sticky left-0 bg-card/60 px-2 py-2 backdrop-blur-md">
                    <span className="mr-2">{h.emoji}</span>{h.name}
                  </td>
                  {days.map((d) => {
                    const done = !!state.logs[d]?.[h.id];
                    return (
                      <td key={d} className="px-1 py-2 text-center">
                        <button
                          onClick={() => toggle(h.id, d)}
                          className={cn(
                            "h-7 w-7 rounded-md border border-border transition",
                            done
                              ? "bg-[var(--gradient-primary)] shadow-[var(--shadow-glow)]"
                              : "bg-secondary/40 hover:bg-secondary",
                          )}
                          aria-label={`${h.name} ${d}`}
                        />
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-right tabular-nums">
                    <span className="inline-flex items-center gap-1 text-[color:var(--warning)]">
                      <Flame className="h-3 w-3" />{s.current}d
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{s.rate}%</td>
                  <td className="px-2 py-2 text-right">
                    <Button size="icon" variant="ghost" onClick={() => remove(h.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
