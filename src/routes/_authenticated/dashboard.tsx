import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Activity,
  Flame,
  Droplets,
  Moon,
  ListChecks,
  TrendingUp,
  Trophy,
  Quote,
} from "lucide-react";
import { useMemo } from "react";
import { useLocal, todayKey, daysAgo } from "@/lib/storage";
import { PageHeader, StatCard } from "@/components/ui-bits";
import { Progress } from "@/components/ui/progress";
import type { RoutineState } from "@/features/routine-types";
import { DEFAULT_ROUTINE } from "@/features/routine-types";
import { useHabits, useHabitLogs, logIndex, isDone } from "@/features/habits-db";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  component: Dashboard,
});

const QUOTES = [
  "Discipline is choosing between what you want now and what you want most.",
  "Small daily improvements are the key to staggering long-term results.",
  "You don't rise to the level of your goals. You fall to the level of your systems.",
  "Win the morning, win the day.",
  "Done is better than perfect.",
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function Dashboard() {
  const [routine] = useLocal<RoutineState>("lifeos:routine", DEFAULT_ROUTINE);
  const today = todayKey();
  const { data: allHabits = [] } = useHabits();
  const positiveHabits = allHabits.filter((h) => h.kind === "positive");
  const { data: todayLogs = [] } = useHabitLogs(today, today);
  const todaySet = useMemo(() => logIndex(todayLogs), [todayLogs]);
  const [water] = useLocal<Record<string, number>>("lifeos:water", {});
  const [sleep] = useLocal<Record<string, { sleep: string; wake: string; hours: number }>>("lifeos:sleep", {});

  const doneToday = routine.items.filter((i) => routine.completion[today]?.[i.id]).length;
  const totalToday = routine.items.length;
  const dailyPct = totalToday ? Math.round((doneToday / totalToday) * 100) : 0;

  const habitsDone = positiveHabits.filter((h) => isDone(todaySet, h.id, today)).length;

  const { weeklyPct, monthlyPct } = useMemo(() => {
    const week = Array.from({ length: 7 }, (_, i) => daysAgo(i));
    const month = Array.from({ length: 30 }, (_, i) => daysAgo(i));
    const calc = (days: string[]) => {
      if (!routine.items.length) return 0;
      let done = 0, total = 0;
      days.forEach((d) => {
        routine.items.forEach((it) => {
          total++;
          if (routine.completion[d]?.[it.id]) done++;
        });
      });
      return total ? Math.round((done / total) * 100) : 0;
    };
    return { weeklyPct: calc(week), monthlyPct: calc(month) };
  }, [routine]);

  const { current, longest } = useMemo(() => {
    let cur = 0, lon = 0, run = 0;
    for (let i = 0; i < 365; i++) {
      const d = daysAgo(i);
      const day = routine.completion[d] ?? {};
      const c = routine.items.filter((it) => day[it.id]).length;
      if (c >= Math.max(1, Math.floor(routine.items.length * 0.6))) {
        run++;
        if (i === 0 || cur === i) cur = run;
        lon = Math.max(lon, run);
      } else {
        if (i === 0) cur = 0;
        run = 0;
      }
    }
    return { current: cur, longest: lon };
  }, [routine]);

  const waterToday = water[today] ?? 0;
  const sleepToday = sleep[today]?.hours ?? sleep[daysAgo(1)]?.hours ?? 0;
  const quote = QUOTES[new Date().getDate() % QUOTES.length];

  const pending = routine.items.filter((i) => !routine.completion[today]?.[i.id]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader
        title={`${greeting()}, Sai 👋`}
        subtitle="Here's your life dashboard for today."
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Daily Completion"
          value={`${dailyPct}%`}
          hint={`${doneToday} of ${totalToday} tasks`}
          icon={<Activity className="h-4 w-4" />}
        />
        <StatCard
          label="Habits Today"
          value={`${habitsDone}/${habits.items.length}`}
          hint="Keep the streak alive"
          icon={<ListChecks className="h-4 w-4" />}
          accent="accent"
        />
        <StatCard
          label="Current Streak"
          value={`${current}d`}
          hint={`Longest: ${longest}d`}
          icon={<Flame className="h-4 w-4" />}
          accent="warning"
        />
        <StatCard
          label="Pending Tasks"
          value={pending.length}
          hint={pending.length ? "Let's finish strong" : "All clear ✨"}
          icon={<Trophy className="h-4 w-4" />}
          accent="success"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="glass rounded-2xl p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Progress Rings</h2>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-5">
            <ProgressRow label="Today" value={dailyPct} />
            <ProgressRow label="This Week" value={weeklyPct} />
            <ProgressRow label="This Month" value={monthlyPct} />
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Health</h2>
          </div>
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><Droplets className="h-4 w-4 text-accent" /> Water</span>
                <span className="text-muted-foreground">{waterToday}ml / 3000ml</span>
              </div>
              <Progress value={Math.min(100, (waterToday / 3000) * 100)} />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><Moon className="h-4 w-4 text-primary" /> Sleep</span>
                <span className="text-muted-foreground">{sleepToday.toFixed(1)}h / 8h</span>
              </div>
              <Progress value={Math.min(100, (sleepToday / 8) * 100)} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 glass relative overflow-hidden rounded-2xl p-6">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[var(--gradient-glow)]" />
        <div className="flex gap-4">
          <Quote className="h-8 w-8 shrink-0 text-primary" />
          <div>
            <p className="text-lg font-medium leading-relaxed">"{quote}"</p>
            <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">Daily Spark</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ProgressRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="font-semibold">{value}%</span>
      </div>
      <Progress value={value} />
    </div>
  );
}
