import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useHabits, useHabitLogs, logIndex, isDone } from "@/features/habits-db";

export const Route = createFileRoute("/_authenticated/report")({
  ssr: false,
  component: ReportPage,
});

const WEEK_COLORS = ["#9EC5FF", "#FFB6C9", "#9FE3D9", "#FFD79A", "#C8B6FF"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function keyOf(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function ReportPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = useMemo(
    () =>
      Array.from({ length: daysInMonth }, (_, i) => {
        const d = new Date(year, month, i + 1);
        return { date: d, key: keyOf(d), day: i + 1 };
      }),
    [year, month, daysInMonth],
  );
  const from = days[0].key;
  const to = days[days.length - 1].key;

  const { data: habits = [] } = useHabits();
  const { data: logs = [] } = useHabitLogs(from, to);
  const set = useMemo(() => logIndex(logs), [logs]);
  const positives = habits.filter((h) => h.kind === "positive");
  const total = positives.length;

  const daily = useMemo(() => {
    return days.map(({ date, key, day }) => {
      const done = total
        ? positives.filter((h) => isDone(set, h.id, key)).length
        : 0;
      const pct = total ? Math.round((done / total) * 100) : 0;
      // Week index: split by 7s from day 1 -> week 1..5
      const week = Math.min(4, Math.floor((day - 1) / 7));
      return { day, key, date, done, pct, week };
    });
  }, [days, positives, set, total]);

  const weeks = useMemo(() => {
    const w = [0, 1, 2, 3, 4].map((wi) => {
      const items = daily.filter((d) => d.week === wi);
      const avg = items.length
        ? Math.round(items.reduce((a, b) => a + b.pct, 0) / items.length)
        : 0;
      return { week: wi + 1, avg, color: WEEK_COLORS[wi], items };
    });
    return w;
  }, [daily]);

  const monthLabel = new Date(year, month, 1).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
  const monthAvg = daily.length
    ? Math.round(daily.reduce((a, b) => a + b.pct, 0) / daily.length)
    : 0;
  const bestDay = daily.reduce((a, b) => (b.pct > a.pct ? b : a), daily[0]);
  const perfectDays = daily.filter((d) => d.pct === 100).length;

  const shift = (delta: number) => {
    const m = month + delta;
    if (m < 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else if (m > 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth(m);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader
        title="Monthly Report"
        subtitle="Your month at a glance — trend, daily breakdown, weekly summary."
        action={
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={() => shift(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["January","February","March","April","May","June","July","August","September","October","November","December"].map((mn, i) => (
                  <SelectItem key={mn} value={String(i)}>{mn}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="h-9 w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 7 }, (_, i) => now.getFullYear() - 3 + i).map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="icon" variant="ghost" onClick={() => shift(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Month Average" value={`${monthAvg}%`} />
        <Stat label="Perfect Days" value={`${perfectDays}`} />
        <Stat label="Best Day" value={bestDay ? `${bestDay.pct}%` : "—"} hint={bestDay ? `${monthLabel.split(" ")[0]} ${bestDay.day}` : ""} />
      </div>

      {/* Area chart */}
      <div className="glass mb-6 rounded-2xl p-4">
        <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">{monthLabel} — Completion Trend</p>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="reportArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#9EC5FF" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#9EC5FF" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="currentColor" opacity={0.4} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="currentColor" opacity={0.4} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => [`${v}%`, "Completion"]}
                labelFormatter={(l) => `Day ${l}`}
              />
              <Area type="monotone" dataKey="pct" stroke="#7BB0FF" strokeWidth={2} fill="url(#reportArea)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-1 grid grid-cols-5 text-center text-xs italic text-muted-foreground">
          {weeks.map((w) => (<div key={w.week}>week {w.week}</div>))}
        </div>
      </div>

      {/* Daily bars */}
      <div className="glass mb-6 rounded-2xl p-4">
        <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Daily Breakdown</p>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="currentColor" opacity={0.4} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="currentColor" opacity={0.4} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(_v: number, _n, p) => [`${p.payload.done}/${total} (${p.payload.pct}%)`, "Done"]}
                labelFormatter={(l) => `Day ${l}`}
              />
              <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                {daily.map((d) => (
                  <Cell key={d.key} fill={WEEK_COLORS[d.week]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* numbers row */}
        <div className="mt-2 overflow-x-auto">
          <div className="flex gap-[2px] text-[9px] tabular-nums" style={{ minWidth: daily.length * 22 }}>
            {daily.map((d) => (
              <div key={d.key} className="flex w-[22px] flex-col items-center">
                <span style={{ color: WEEK_COLORS[d.week] }}>{d.pct}%</span>
                <span className="text-foreground/80">{d.done}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Weekly donuts */}
      <div className="glass rounded-2xl p-4">
        <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Weekly Summary</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {weeks.map((w) => (
            <div key={w.week} className="flex flex-col items-center gap-2">
              <Donut value={w.avg} color={w.color} />
              <p className="text-xs italic text-muted-foreground">week {w.week}</p>
              <div
                className="h-[3px] w-12 rounded-full"
                style={{ background: w.color }}
              />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Donut({ value, color }: { value: number; color: string }) {
  const size = 90;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeOpacity={0.12} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="text-sm font-semibold italic">{value.toFixed(1)}%</span>
      </div>
    </div>
  );
}
