import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Activity, Ban, Flame, ListChecks, TrendingUp, Trophy, Quote } from "lucide-react";
import { useMemo } from "react";
import { useCurrentUsername } from "@/lib/auth";
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

function toKey(d: Date): string {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** "This Week" = the current 7-day chunk of the calendar month: 1–7, 8–14,
 * 15–21, 22–28, 29–end. Only days up to today are counted (no future days). */
function weekChunkDayKeys(now: Date): string[] {
  const dayOfMonth = now.getDate();
  const chunkStartDay = Math.floor((dayOfMonth - 1) / 7) * 7 + 1;
  const keys: string[] = [];
  for (let d = chunkStartDay; d <= dayOfMonth; d++) {
    keys.push(toKey(new Date(now.getFullYear(), now.getMonth(), d)));
  }
  return keys;
}

/** "This Month" = the 1st of the current calendar month through today
 * (never past the actual end of the month, since it stops at "today"). */
function monthToDateDayKeys(now: Date): string[] {
  const keys: string[] = [];
  for (let d = 1; d <= now.getDate(); d++) {
    keys.push(toKey(new Date(now.getFullYear(), now.getMonth(), d)));
  }
  return keys;
}

function Dashboard() {
  const today = todayKey();
  // Wide enough to cover both a 31-day month-to-date and the 30-day streak
  // lookback below, whichever needs more history.
  const from35 = daysAgo(34);
  const { data: username = "" } = useCurrentUsername();

  const { data: allHabits = [] } = useHabits();
  const positiveHabits = allHabits.filter((h) => h.kind === "positive");
  const negativeHabits = allHabits.filter((h) => h.kind === "negative");
  const { data: logs30 = [] } = useHabitLogs(from35, today);
  const habitSet = useMemo(() => logIndex(logs30), [logs30]);

  const { data: routineItems = [] } = useRoutineItems();
  const { data: routineLogs = [] } = useRoutineLogs(from35, today);
  const routineSet = useMemo(() => routineLogIndex(routineLogs), [routineLogs]);

  const doneToday = routineItems.filter((i) => isRoutineDone(routineSet, i.id, today)).length;
  const totalToday = routineItems.length;
  const dailyPct = totalToday ? Math.round((doneToday / totalToday) * 100) : 0;

  const habitsDone = positiveHabits.filter((h) => isDone(habitSet, h.id, today)).length;
  const avoidedToday = negativeHabits.filter((h) => isDone(habitSet, h.id, today)).length;

  // Combined progress: positive habits + avoid list (negatives).
  // Only counts a habit on days on/after it was actually created — otherwise
  // a habit added yesterday would count as "missed" for days before it
  // existed and drag the weekly/monthly % down incorrectly.
  const { weeklyPct, monthlyPct } = useMemo(() => {
    const calcFor = (days: string[]) => {
      let done = 0;
      let total = 0;
      const tally = (h: (typeof positiveHabits)[number]) => {
        const createdKey = h.created_at.slice(0, 10);
        days.forEach((d) => {
          if (d < createdKey) return; // habit didn't exist yet on this day
          total++;
          if (isDone(habitSet, h.id, d)) done++;
        });
      };
      positiveHabits.forEach(tally);
      negativeHabits.forEach(tally);
      return total ? Math.round((done / total) * 100) : 0;
    };
    const now = new Date();
    return {
      weeklyPct: calcFor(weekChunkDayKeys(now)),
      monthlyPct: calcFor(monthToDateDayKeys(now)),
    };
  }, [positiveHabits, negativeHabits, habitSet]);

  const todayCombinedPct = useMemo(() => {
    const total = positiveHabits.length + negativeHabits.length;
    if (!total) return 0;
    return Math.round(((habitsDone + avoidedToday) / total) * 100);
  }, [positiveHabits.length, negativeHabits.length, habitsDone, avoidedToday]);

  const { current, longest } = useMemo(() => {
    let cur = 0;
    let lon = 0;
    let run = 0;
    for (let i = 0; i < 30; i++) {
      const d = daysAgo(i);
      const existingPos = positiveHabits.filter((h) => h.created_at.slice(0, 10) <= d);
      const existingNeg = negativeHabits.filter((h) => h.created_at.slice(0, 10) <= d);
      const totalExisting = existingPos.length + existingNeg.length;
      if (totalExisting === 0) {
        if (i === 0) cur = 0;
        run = 0;
        continue;
      }
      const threshold = Math.max(1, Math.floor(totalExisting * 0.6));
      const c =
        existingPos.filter((h) => isDone(habitSet, h.id, d)).length +
        existingNeg.filter((h) => isDone(habitSet, h.id, d)).length;
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
  }, [positiveHabits, negativeHabits, habitSet]);

  const quote = QUOTES[new Date().getDate() % QUOTES.length];
  const pendingRoutine = routineItems.filter((i) => !isRoutineDone(routineSet, i.id, today));
  const pendingHabits = positiveHabits.length - habitsDone;
  const pendingAvoid = negativeHabits.length - avoidedToday;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader
        title={`${greeting()}${username ? `, ${username}` : ""} 👋`}
        subtitle="Here's your life dashboard for today."
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
          label="Avoided Today"
          value={`${avoidedToday}/${negativeHabits.length}`}
          hint={pendingAvoid ? `${pendingAvoid} still to resist` : "All resisted ✨"}
          icon={<Ban className="h-4 w-4" />}
          accent="success"
        />
        <StatCard
          label="Current Streak"
          value={`${current}d`}
          hint={`Longest: ${longest}d`}
          icon={<Flame className="h-4 w-4" />}
          accent="warning"
        />
        <StatCard
          label="Pending"
          value={pendingRoutine.length}
          hint={
            pendingHabits
              ? `${pendingHabits} habit${pendingHabits > 1 ? "s" : ""} left`
              : "All clear ✨"
          }
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
          <ProgressRow label="Today (habits + avoid)" value={todayCombinedPct} />
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
            <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">
              Daily Spark
            </p>
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