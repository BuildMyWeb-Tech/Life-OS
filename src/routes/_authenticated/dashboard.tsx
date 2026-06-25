import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Activity,
  Flame,
  ListChecks,
  TrendingUp,
  Trophy,
  Quote,
} from "lucide-react";
import { useMemo } from "react";
import { todayKey, daysAgo } from "@/lib/storage";
import { PageHeader, StatCard } from "@/components/ui-bits";
import { Progress } from "@/components/ui/progress";
import { useHabits, useHabitLogs, logIndex, isDone } from "@/features/habits-db";
import {
  useRoutineItems,
  useRoutineLogs,
  routineLogIndex,
  isRoutineDone,
} from "@/features/routine-db";

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
  const today = todayKey();
  const from30 = daysAgo(29);

  const { data: allHabits = [] } = useHabits();
  const positiveHabits = allHabits.filter((h) => h.kind === "positive");
  const { data: todayLogs = [] } = useHabitLogs(today, today);
  const todaySet = useMemo(() => logIndex(todayLogs), [todayLogs]);

  const { data: routineItems = [] } = useRoutineItems();
  const { data: routineLogs = [] } = useRoutineLogs(from30, today);
  const routineSet = useMemo(() => routineLogIndex(routineLogs), [routineLogs]);

  const doneToday = routineItems.filter((i) => isRoutineDone(routineSet, i.id, today)).length;
  const totalToday = routineItems.length;
  const dailyPct = totalToday ? Math.round((doneToday / totalToday) * 100) : 0;

  const habitsDone = positiveHabits.filter((h) => isDone(todaySet, h.id, today)).length;

  const { weeklyPct, monthlyPct } = useMemo(() => {
    const calc = (n: number) => {
      if (!routineItems.length) return 0;
      const days = Array.from({ length: n }, (_, i) => daysAgo(i));
      let done = 0;
      let total = 0;
      days.forEach((d) => {
        routineItems.forEach((it) => {
          total++;
          if (isRoutineDone(routineSet, it.id, d)) done++;
        });
      });
      return total ? Math.round((done / total) * 100) : 0;
    };
    return { weeklyPct: calc(7), monthlyPct: calc(30) };
  }, [routineItems, routineSet]);

  const { current, longest } = useMemo(() => {
    let cur = 0;
    let lon = 0;
    let run = 0;
    const threshold = Math.max(1, Math.floor(routineItems.length * 0.6));
    for (let i = 0; i < 30; i++) {
      const d = daysAgo(i);
      const c = routineItems.filter((it) => isRoutineDone(routineSet, it.id, d)).length;
      if (c >= threshold) {
        run++;
        if (i === 0 || cur === i) cur = run;
        lon = Math.max(lon, run);
      } else {
        if (i === 0) cur = 0;
        run = 0;
      }
    }
    return { current: cur, longest: lon };
  }, [routineItems, routineSet]);

  const quote = QUOTES[new Date().getDate() % QUOTES.length];
  const pending = routineItems.filter((i) => !isRoutineDone(routineSet, i.id, today));

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
          value={`${habitsDone}/${positiveHabits.length}`}
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

      <div className="mt-6 glass rounded-2xl p-6">
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
