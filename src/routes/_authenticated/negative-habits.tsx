import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Ban, Plus, Trash2, Flame, Trophy, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader, StatCard } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { todayKey, daysAgo } from "@/lib/storage";
import {
  useCategories,
  useHabits,
  useHabitLogs,
  useToggleHabit,
  useCreateHabit,
  useUpdateHabit,
  useDeleteHabit,
  logIndex,
  isDone,
  type Habit,
} from "@/features/habits-db";
import {
  useRoutineItems,
  useRoutineLogs,
  useToggleRoutine,
  routineLogIndex,
  isRoutineDone,
} from "@/features/routine-db";
import { findRoutineByName } from "@/lib/cross-sync";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/negative-habits")({
  ssr: false,
  component: NegativeHabitsPage,
});

const WINDOW = 60;

function NegativeHabitsPage() {
  const today = todayKey();
  const days = useMemo(() => Array.from({ length: WINDOW }, (_, i) => daysAgo(WINDOW - 1 - i)), []);
  const from = days[0]!;
  const to = days[days.length - 1]!;

  const { data: cats = [] } = useCategories();
  const { data: habits = [] } = useHabits();
  const { data: logs = [] } = useHabitLogs(from, to);
  const toggle = useToggleHabit();
  const create = useCreateHabit();
  const update = useUpdateHabit();
  const del = useDeleteHabit();

  const { data: routineItems = [] } = useRoutineItems();
  const { data: routineLogsToday = [] } = useRoutineLogs(today, today);
  const routineSetToday = useMemo(() => routineLogIndex(routineLogsToday), [routineLogsToday]);
  const routineToggle = useToggleRoutine();

  const mirror = (habitName: string, done: boolean, date: string) => {
    if (date !== today) return;
    const item = findRoutineByName(routineItems, habitName);
    if (!item) return;
    const currentlyDone = isRoutineDone(routineSetToday, item.id, date);
    if (currentlyDone === done) return;
    routineToggle.mutate({ item_id: item.id, log_date: date, done });
  };

  const set = useMemo(() => logIndex(logs), [logs]);
  const negs = habits.filter((h) => h.kind === "negative");
  const avoidCat = cats.find((c) => c.name.toLowerCase() === "avoid");

  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Habit | null>(null);

  const add = () => {
    if (!name.trim()) return;
    create.mutate({
      name: name.trim().startsWith("No ") ? name.trim() : `No ${name.trim()}`,
      emoji: "🚫",
      kind: "negative",
      frequency: "daily",
      category_id: avoidCat?.id ?? null,
      sort_order: 999,
    });
    setName("");
  };

  const stats = (id: string) => {
    let cur = 0, run = 0, longest = 0, succ = 0;
    for (let i = 0; i < WINDOW; i++) {
      const d = daysAgo(i);
      const ok = isDone(set, id, d);
      if (ok) {
        succ++;
        run++;
        if (i === 0 || cur === i) cur = run;
        longest = Math.max(longest, run);
      } else {
        if (i === 0) cur = 0;
        run = 0;
      }
    }
    return { current: cur, longest, rate: Math.round((succ / WINDOW) * 100) };
  };

  const bestStreak = negs.reduce((m, h) => Math.max(m, stats(h.id).longest), 0);
  const avgRate = negs.length ? Math.round(negs.reduce((s, h) => s + stats(h.id).rate, 0) / negs.length) : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader title="Avoid List" subtitle="Track what you DON'T want to do. Tap a day after surviving it." />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Avoid Habits" value={negs.length} icon={<Ban className="h-4 w-4" />} />
        <StatCard label="Avg Success Rate" value={`${avgRate}%`} hint={`Last ${WINDOW} days`} accent="success" />
        <StatCard label="Best Streak" value={`${bestStreak}d`} icon={<Trophy className="h-4 w-4" />} accent="warning" />
      </div>

      <div className="glass mb-4 flex gap-2 rounded-2xl p-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Something to avoid (e.g. Coffee)"
          className="bg-transparent"
        />
        <Button onClick={add} className="gap-2"><Plus className="h-4 w-4" /> Add</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {negs.map((h) => {
          const s = stats(h.id);
          const todayOK = isDone(set, h.id, today);
          return (
            <div key={h.id} className="glass rounded-2xl p-4">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="text-lg font-semibold"><span className="mr-2">{h.emoji}</span>{h.name}</p>
                  <p className="text-xs text-muted-foreground">Tap today to mark as avoided.</p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(h)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(h.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                <Stat label="Streak" value={`${s.current}d`} icon={<Flame className="h-3 w-3" />} />
                <Stat label="Longest" value={`${s.longest}d`} />
                <Stat label="Success" value={`${s.rate}%`} />
              </div>

              <button
                onClick={() => {
                  const next = !todayOK;
                  toggle.mutate({ habit_id: h.id, log_date: today, done: next });
                  mirror(h.name, next, today);
                }}
                className={cn(
                  "mb-3 w-full rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition",
                  todayOK
                    ? "bg-[color:var(--success)]/20 text-[color:var(--success)]"
                    : "bg-secondary/50 hover:bg-secondary",
                )}
              >
                {todayOK ? "✓ Avoided today" : "Mark today avoided"}
              </button>

              <div className="flex flex-wrap gap-1">
                {days.slice(-30).map((d) => {
                  const ok = isDone(set, h.id, d);
                  const isToday = d === today;
                  return (
                    <button
                      key={d}
                      onClick={() => {
                        const next = !ok;
                        toggle.mutate({ habit_id: h.id, log_date: d, done: next });
                        mirror(h.name, next, d);
                      }}
                      title={d}
                      className={cn(
                        "h-5 w-5 rounded-full border transition",
                        ok
                          ? "border-[color:var(--success)]/60 bg-[color:var(--success)]/60"
                          : "border-border bg-secondary/40 hover:bg-secondary",
                        isToday && "ring-2 ring-primary/60",
                      )}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <EditDialog
        habit={editing}
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          if (!editing) return;
          update.mutate({ id: editing.id, ...patch });
          setEditing(null);
        }}
      />
    </motion.div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-secondary/40 p-2">
      <p className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </p>
      <p className="text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function EditDialog({
  habit,
  onClose,
  onSave,
}: {
  habit: Habit | null;
  onClose: () => void;
  onSave: (p: { name: string; emoji: string | null }) => void;
}) {
  return (
    <Dialog open={!!habit} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass">
        <DialogHeader><DialogTitle>Edit Avoid Habit</DialogTitle></DialogHeader>
        {habit && <EditForm key={habit.id} habit={habit} onClose={onClose} onSave={onSave} />}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({
  habit,
  onClose,
  onSave,
}: {
  habit: Habit;
  onClose: () => void;
  onSave: (p: { name: string; emoji: string | null }) => void;
}) {
  const [name, setName] = useState(habit.name);
  const [emoji, setEmoji] = useState(habit.emoji ?? "");
  return (
    <>
      <div className="space-y-4">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>Emoji</Label>
          <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), emoji: emoji.trim() || null })}>Save</Button>
      </DialogFooter>
    </>
  );
}
