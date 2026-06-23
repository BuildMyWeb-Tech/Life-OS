import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  Flame,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  GitBranch,
} from "lucide-react";
import { PageHeader, StatCard } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { todayKey, daysAgo } from "@/lib/storage";
import {
  useCategories,
  useHabits,
  useHabitLogs,
  useToggleHabit,
  useCreateHabit,
  useDeleteHabit,
  logIndex,
  isDone,
  type Habit,
} from "@/features/habits-db";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/habits")({
  ssr: false,
  component: HabitsPage,
});

function HabitsPage() {
  const today = todayKey();
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => daysAgo(13 - i)), []);
  const from = days[0]!;
  const to = days[days.length - 1]!;

  const { data: cats = [] } = useCategories();
  const { data: habits = [], isLoading } = useHabits();
  const { data: logs = [] } = useHabitLogs(from, to);
  const toggle = useToggleHabit();
  const create = useCreateHabit();
  const del = useDeleteHabit();

  const set = useMemo(() => logIndex(logs), [logs]);

  const [name, setName] = useState("");
  const [catId, setCatId] = useState<string>("none");
  const [parentId, setParentId] = useState<string>("none");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const positive = habits.filter((h) => h.kind === "positive");
  const subsOf = (id: string) => positive.filter((h) => h.parent_id === id);

  const stats = (id: string) => {
    let cur = 0, run = 0, longest = 0, done = 0;
    const total = 90;
    for (let i = 0; i < total; i++) {
      const d = daysAgo(i);
      const isD = isDone(set, id, d);
      if (isD) {
        done++;
        run++;
        if (i === 0 || cur === i) cur = run;
        longest = Math.max(longest, run);
      } else {
        if (i === 0) cur = 0;
        run = 0;
      }
    }
    return { current: cur, longest, rate: Math.round((done / total) * 100) };
  };

  const doneToday = positive.filter((h) => isDone(set, h.id, today)).length;
  const ranked = positive.map((h) => ({ h, s: stats(h.id) })).sort((a, b) => b.s.rate - a.s.rate);
  const best = ranked[0];

  const add = () => {
    if (!name.trim()) return;
    create.mutate({
      name: name.trim(),
      emoji: "⭐",
      kind: "positive",
      frequency: "daily",
      category_id: catId === "none" ? null : catId,
      parent_id: parentId === "none" ? null : parentId,
      sort_order: 999,
    });
    setName("");
  };

  // Group positive parents by category
  const parents = positive.filter((h) => !h.parent_id);
  const byCat: Record<string, Habit[]> = {};
  const noCat: Habit[] = [];
  parents.forEach((h) => {
    if (!h.category_id) noCat.push(h);
    else (byCat[h.category_id] ??= []).push(h);
  });

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader title="Habit Tracker" subtitle="Build the system. The system builds you." />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Today" value={`${doneToday}/${positive.length}`} icon={<Flame className="h-4 w-4" />} />
        <StatCard label="Best Habit" value={best ? `${best.s.rate}%` : "—"} hint={best?.h.name} accent="success" />
        <StatCard label="Total Habits" value={positive.length} accent="accent" />
      </div>

      <div className="glass mb-4 flex flex-wrap items-center gap-2 rounded-2xl p-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="New habit (e.g. Read 20 pages)"
          className="min-w-[180px] flex-1 bg-transparent"
        />
        <Select value={catId} onValueChange={setCatId}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— No category —</SelectItem>
            {cats.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={parentId} onValueChange={setParentId}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Parent habit" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Top level —</SelectItem>
            {parents.map((p) => (
              <SelectItem key={p.id} value={p.id}>↳ Sub of {p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={add} className="gap-2"><Plus className="h-4 w-4" /> Add</Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      <div className="space-y-6">
        {[...cats, { id: "__none__", name: "Uncategorized", color: "#6b7280" }].map((c) => {
          const items = c.id === "__none__" ? noCat : (byCat[c.id] ?? []);
          if (!items.length) return null;
          return (
            <section key={c.id} className="glass overflow-hidden rounded-2xl p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {c.name}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-2 py-2">Habit</th>
                      {days.map((d) => (
                        <th key={d} className="px-1 py-2 text-center">{d.slice(8)}</th>
                      ))}
                      <th className="px-2 py-2 text-right">Streak</th>
                      <th className="px-2 py-2 text-right">Rate</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {items.flatMap((h) => {
                      const subs = subsOf(h.id);
                      const isOpen = !collapsed[h.id];
                      const s = stats(h.id);
                      // sub-habit-aware completion for today
                      const subsToday = subs.filter((sh) => isDone(set, sh.id, today)).length;
                      const subPct = subs.length ? Math.round((subsToday / subs.length) * 100) : null;
                      const rows = [
                        <HabitRow
                          key={h.id}
                          h={h}
                          days={days}
                          set={set}
                          stats={s}
                          subPct={subPct}
                          subCount={subs.length}
                          isOpen={isOpen}
                          onToggleOpen={() =>
                            setCollapsed((c) => ({ ...c, [h.id]: !c[h.id] }))
                          }
                          onToggle={(d) =>
                            toggle.mutate({
                              habit_id: h.id,
                              log_date: d,
                              done: !isDone(set, h.id, d),
                            })
                          }
                          onDelete={() => del.mutate(h.id)}
                        />,
                      ];
                      if (isOpen) {
                        subs.forEach((sh) =>
                          rows.push(
                            <HabitRow
                              key={sh.id}
                              h={sh}
                              indent
                              days={days}
                              set={set}
                              stats={stats(sh.id)}
                              onToggle={(d) =>
                                toggle.mutate({
                                  habit_id: sh.id,
                                  log_date: d,
                                  done: !isDone(set, sh.id, d),
                                })
                              }
                              onDelete={() => del.mutate(sh.id)}
                            />,
                          ),
                        );
                      }
                      return rows;
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </motion.div>
  );
}

function HabitRow({
  h,
  days,
  set,
  stats,
  subPct,
  subCount,
  isOpen,
  onToggleOpen,
  onToggle,
  onDelete,
  indent,
}: {
  h: Habit;
  days: string[];
  set: Set<string>;
  stats: { current: number; longest: number; rate: number };
  subPct?: number | null;
  subCount?: number;
  isOpen?: boolean;
  onToggleOpen?: () => void;
  onToggle: (d: string) => void;
  onDelete: () => void;
  indent?: boolean;
}) {
  return (
    <tr className="border-t border-border">
      <td className={cn("px-2 py-2", indent && "pl-8")}>
        <div className="flex items-center gap-2">
          {!!subCount && subCount > 0 && (
            <button onClick={onToggleOpen} className="text-muted-foreground hover:text-foreground">
              {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          )}
          {indent && <GitBranch className="h-3 w-3 text-muted-foreground" />}
          <span>{h.emoji}</span>
          <span className={cn(indent && "text-muted-foreground")}>{h.name}</span>
          {subPct !== null && subPct !== undefined && (
            <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">
              {subPct}% · {subCount} subs
            </span>
          )}
        </div>
      </td>
      {days.map((d) => {
        const done = isDone(set, h.id, d);
        return (
          <td key={d} className="px-1 py-2 text-center">
            <button
              onClick={() => onToggle(d)}
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
          <Flame className="h-3 w-3" />
          {stats.current}d
        </span>
      </td>
      <td className="px-2 py-2 text-right tabular-nums">{stats.rate}%</td>
      <td className="px-2 py-2 text-right">
        <Button size="icon" variant="ghost" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}
