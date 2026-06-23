import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Droplets, Moon, X, Flame, Ban } from "lucide-react";
import { PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { useLocal } from "@/lib/storage";
import { useHabits, useHabitLogs, logIndex, isDone } from "@/features/habits-db";
import type { RoutineState } from "@/features/routine-types";
import { DEFAULT_ROUTINE } from "@/features/routine-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendar")({
  ssr: false,
  component: CalendarPage,
});

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function CalendarPage() {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string | null>(toKey(new Date()));

  const monthStart = cursor;
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const from = toKey(monthStart);
  const to = toKey(monthEnd);

  const { data: habits = [] } = useHabits();
  const { data: logs = [] } = useHabitLogs(from, to);
  const [routine] = useLocal<RoutineState>("lifeos:routine", DEFAULT_ROUTINE);
  const [water] = useLocal<Record<string, number>>("lifeos:water", {});
  const [sleep] = useLocal<Record<string, { sleep: string; wake: string; hours: number }>>(
    "lifeos:sleep",
    {},
  );

  const set = useMemo(() => logIndex(logs), [logs]);
  const positives = habits.filter((h) => h.kind === "positive");
  const negatives = habits.filter((h) => h.kind === "negative");

  // Build calendar grid (Mon-start)
  const cells = useMemo(() => {
    const first = new Date(monthStart);
    const dayOfWeek = (first.getDay() + 6) % 7; // 0=Mon
    const startDate = new Date(first);
    startDate.setDate(first.getDate() - dayOfWeek);
    const out: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      out.push(d);
    }
    return out;
  }, [monthStart]);

  const dayScore = (key: string) => {
    if (!positives.length) return 0;
    const done = positives.filter((h) => isDone(set, h.id, key)).length;
    return Math.round((done / positives.length) * 100);
  };

  const monthLabel = cursor.toLocaleString("default", { month: "long", year: "numeric" });
  const todayKey = toKey(new Date());

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader
        title="Calendar"
        subtitle="Tap any day to see everything that happened (or didn't)."
        action={
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[160px] text-center font-semibold">{monthLabel}</span>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const d = new Date();
                setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
                setSelected(toKey(d));
              }}
            >
              Today
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="glass rounded-2xl p-4">
          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d) => {
              const key = toKey(d);
              const inMonth = d.getMonth() === cursor.getMonth();
              const score = dayScore(key);
              const isSel = key === selected;
              const isToday = key === todayKey;
              return (
                <button
                  key={key}
                  onClick={() => setSelected(key)}
                  className={cn(
                    "relative aspect-square rounded-lg border border-border text-left transition",
                    !inMonth && "opacity-30",
                    isSel
                      ? "ring-2 ring-primary"
                      : "hover:border-primary/50",
                  )}
                  style={{
                    background:
                      score > 0
                        ? `color-mix(in oklab, var(--primary) ${Math.min(score, 90)}%, transparent)`
                        : undefined,
                  }}
                >
                  <span
                    className={cn(
                      "absolute left-1.5 top-1 text-xs font-semibold tabular-nums",
                      isToday && "rounded-full bg-primary px-1.5 text-primary-foreground",
                    )}
                  >
                    {d.getDate()}
                  </span>
                  {score > 0 && (
                    <span className="absolute bottom-1 right-1.5 text-[10px] font-medium text-primary-foreground/90">
                      {score}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Color intensity = % of positive habits completed that day.
          </p>
        </div>

        {selected && (
          <DayPanel
            dateKey={selected}
            onClose={() => setSelected(null)}
            positives={positives}
            negatives={negatives}
            set={set}
            water={water[selected]}
            sleep={sleep[selected]?.hours}
            routine={routine}
          />
        )}
      </div>
    </motion.div>
  );
}

function DayPanel({
  dateKey,
  onClose,
  positives,
  negatives,
  set,
  water,
  sleep,
  routine,
}: {
  dateKey: string;
  onClose: () => void;
  positives: ReturnType<typeof useHabits>["data"];
  negatives: ReturnType<typeof useHabits>["data"];
  set: Set<string>;
  water?: number;
  sleep?: number;
  routine: RoutineState;
}) {
  const dateObj = new Date(dateKey + "T00:00:00");
  const label = dateObj.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const posDone = (positives ?? []).filter((h) => isDone(set, h.id, dateKey));
  const posMissed = (positives ?? []).filter((h) => !isDone(set, h.id, dateKey));
  const negSurvived = (negatives ?? []).filter((h) => isDone(set, h.id, dateKey));
  const negFailed = (negatives ?? []).filter((h) => !isDone(set, h.id, dateKey));
  const routineDone = routine.items.filter((i) => routine.completion[dateKey]?.[i.id]);

  return (
    <div className="glass sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Day Details</p>
          <h2 className="text-xl font-semibold">{label}</h2>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <Metric icon={<Droplets className="h-3 w-3" />} label="Water" value={`${water ?? 0}ml`} />
        <Metric icon={<Moon className="h-3 w-3" />} label="Sleep" value={`${(sleep ?? 0).toFixed(1)}h`} />
      </div>

      <Section title="Positive Habits" tone="success">
        <List items={posDone.map((h) => `${h.emoji ?? "✓"} ${h.name}`)} emptyText="None completed" />
        {!!posMissed.length && (
          <p className="mt-2 text-xs text-muted-foreground">
            Missed: {posMissed.map((h) => h.name).join(", ")}
          </p>
        )}
      </Section>

      <Section title="Avoided" icon={<Ban className="h-3 w-3" />}>
        <List items={negSurvived.map((h) => h.name)} emptyText="None tracked" />
        {!!negFailed.length && (
          <p className="mt-2 text-xs text-[color:var(--destructive)]">
            Slipped: {negFailed.map((h) => h.name).join(", ")}
          </p>
        )}
      </Section>

      <Section title="Routine">
        <List items={routineDone.map((r) => `${r.time ?? ""} ${r.title}`.trim())} emptyText="No routine items completed" />
      </Section>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-secondary/40 p-3">
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Section({
  title,
  children,
  tone,
  icon,
}: {
  title: string;
  children: React.ReactNode;
  tone?: "success";
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <p
        className={cn(
          "mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider",
          tone === "success" ? "text-[color:var(--success)]" : "text-muted-foreground",
        )}
      >
        {icon ?? <Flame className="h-3 w-3" />} {title}
      </p>
      {children}
    </div>
  );
}

function List({ items, emptyText }: { items: string[]; emptyText: string }) {
  if (!items.length) return <p className="text-xs text-muted-foreground">{emptyText}</p>;
  return (
    <ul className="space-y-1 text-sm">
      {items.map((it, i) => (
        <li key={i} className="rounded-md bg-secondary/30 px-2 py-1">{it}</li>
      ))}
    </ul>
  );
}
