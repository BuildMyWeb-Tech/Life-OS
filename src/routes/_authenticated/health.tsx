import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Droplets, Moon, Plus, Sunrise } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMemo } from "react";
import { PageHeader, StatCard } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useLocal, todayKey, daysAgo } from "@/lib/storage";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/health")({
  ssr: false,
  component: HealthPage,
});

type SleepEntry = { sleep: string; wake: string; hours: number };
const GOAL = 3000;

function HealthPage() {
  const today = todayKey();
  const [water, setWater] = useLocal<Record<string, number>>("lifeos:water", {});
  const [sleep, setSleep] = useLocal<Record<string, SleepEntry>>("lifeos:sleep", {});

  const ml = water[today] ?? 0;
  const addWater = (v: number) =>
    setWater((w) => ({ ...w, [today]: Math.max(0, (w[today] ?? 0) + v) }));

  const sleepToday = sleep[today] ?? { sleep: "", wake: "", hours: 0 };

  const updateSleep = (patch: Partial<SleepEntry>) =>
    setSleep((s) => {
      const cur = s[today] ?? { sleep: "", wake: "", hours: 0 };
      const next = { ...cur, ...patch };
      next.hours = computeHours(next.sleep, next.wake);
      return { ...s, [today]: next };
    });

  const sleepData = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = daysAgo(6 - i);
        return { day: d.slice(5), hours: sleep[d]?.hours ?? 0 };
      }),
    [sleep],
  );

  const waterData = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = daysAgo(6 - i);
        return { day: d.slice(5), ml: water[d] ?? 0 };
      }),
    [water],
  );

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader title="Water & Sleep" subtitle="The foundation of every good day." />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Water */}
        <div className="glass rounded-2xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold"><Droplets className="h-5 w-5 text-accent" /> Water</h2>
              <p className="text-xs text-muted-foreground">Goal · 3 litres</p>
            </div>
            <StatCard label="Today" value={`${ml}ml`} className="!p-3" />
          </div>

          <div className="mb-6">
            <Progress value={Math.min(100, (ml / GOAL) * 100)} className="h-3" />
            <p className="mt-2 text-right text-xs text-muted-foreground">{Math.min(100, Math.round((ml / GOAL) * 100))}% of goal</p>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[250, 500, 750, 1000].map((v) => (
              <Button key={v} variant="secondary" onClick={() => { addWater(v); toast(`+${v}ml`); }} className="flex-col h-auto py-3">
                <Plus className="h-3 w-3" />
                <span className="text-sm font-semibold">{v}ml</span>
              </Button>
            ))}
          </div>
          <Button variant="ghost" className="mt-3 w-full" onClick={() => setWater((w) => ({ ...w, [today]: 0 }))}>Reset Today</Button>

          <div className="mt-6 h-40">
            <ResponsiveContainer>
              <BarChart data={waterData}>
                <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
                <XAxis dataKey="day" stroke="oklch(0.7 0.02 270)" fontSize={11} />
                <YAxis stroke="oklch(0.7 0.02 270)" fontSize={11} />
                <Tooltip contentStyle={{ background: "oklch(0.2 0.025 270)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12 }} />
                <Bar dataKey="ml" fill="oklch(0.72 0.17 200)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sleep */}
        <div className="glass rounded-2xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold"><Moon className="h-5 w-5 text-primary" /> Sleep</h2>
              <p className="text-xs text-muted-foreground">Goal · 8 hours</p>
            </div>
            <StatCard label="Last night" value={`${sleepToday.hours.toFixed(1)}h`} className="!p-3" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Sleep time</Label>
              <Input type="time" value={sleepToday.sleep} onChange={(e) => updateSleep({ sleep: e.target.value })} />
            </div>
            <div>
              <Label className="flex items-center gap-1"><Sunrise className="h-3 w-3" /> Wake time</Label>
              <Input type="time" value={sleepToday.wake} onChange={(e) => updateSleep({ wake: e.target.value })} />
            </div>
          </div>

          <div className="mt-6">
            <Progress value={Math.min(100, (sleepToday.hours / 8) * 100)} className="h-3" />
          </div>

          <div className="mt-6 h-40">
            <ResponsiveContainer>
              <BarChart data={sleepData}>
                <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
                <XAxis dataKey="day" stroke="oklch(0.7 0.02 270)" fontSize={11} />
                <YAxis stroke="oklch(0.7 0.02 270)" fontSize={11} />
                <Tooltip contentStyle={{ background: "oklch(0.2 0.025 270)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12 }} />
                <Bar dataKey="hours" fill="oklch(0.74 0.18 295)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function computeHours(sleepT: string, wakeT: string) {
  if (!sleepT || !wakeT) return 0;
  const [sh, sm] = sleepT.split(":").map(Number);
  const [wh, wm] = wakeT.split(":").map(Number);
  let mins = wh * 60 + wm - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  return Math.round((mins / 60) * 10) / 10;
}
