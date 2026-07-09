import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlarmClock, BellRing, X } from "lucide-react";
import { useTasks, useUpdateTask } from "./tasks-db";
import { useWorkNodes, useUpdateWorkNode } from "./work-db";
import { useRoutineItems, useRoutineLogs, useToggleRoutine, routineLogIndex } from "./routine-db";
import { Button } from "@/components/ui/button";
import { logicalTodayKey } from "@/lib/storage";

type Fire = {
  key: string; // unique per (source, id, iso-datetime) — also used as the notification tag
  source: "task" | "work" | "routine";
  id: string;
  title: string;
  when: Date;
  meta?: string;
  onDone?: () => void;
};

// ------- audio: generate a repeating beep with Web Audio, no asset -------
function makeAlarm() {
  let ctx: AudioContext | null = null;
  let stop = false;
  let timer: number | null = null;

  const beep = () => {
    if (!ctx || stop) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.02);
    gain.gain.linearRampToValueAtTime(0, now + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  };

  return {
    start() {
      stop = false;
      try {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        beep();
        timer = window.setInterval(beep, 700);
        // Auto-stop after 30s so it isn't annoying forever
        window.setTimeout(() => this.stop(), 30_000);
      } catch {
        /* audio blocked */
      }
    },
    stop() {
      stop = true;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      if (ctx) {
        try {
          ctx.close();
        } catch {
          /* noop */
        }
        ctx = null;
      }
    },
  };
}

const FIRED_KEY = "lifeos:reminders:fired";
function loadFired(): Set<string> {
  try {
    const raw = sessionStorage.getItem(FIRED_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}
function saveFired(s: Set<string>) {
  try {
    sessionStorage.setItem(FIRED_KEY, JSON.stringify([...s]));
  } catch {
    /* noop */
  }
}

function parseAt(dateStr: string, timeStr: string): Date | null {
  // dateStr = YYYY-MM-DD, timeStr = HH:MM[:SS]
  if (!dateStr || !timeStr) return null;
  const [h, m] = timeStr.split(":");
  if (h === undefined || m === undefined) return null;
  const d = new Date(dateStr + "T00:00:00");
  d.setHours(Number(h), Number(m), 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function Reminders() {
  const { data: tasks = [] } = useTasks();
  const { data: nodes = [] } = useWorkNodes();
  const { data: items = [] } = useRoutineItems();
  const today = logicalTodayKey();
  const { data: logs = [] } = useRoutineLogs(today, today);

  const updateTask = useUpdateTask();
  const updateNode = useUpdateWorkNode();
  const toggleRoutine = useToggleRoutine();

  const [active, setActive] = useState<Fire | null>(null);
  const alarmRef = useRef<ReturnType<typeof makeAlarm> | null>(null);
  const firedRef = useRef<Set<string>>(new Set());
  const permAskedRef = useRef(false);
  // Every fire currently known, keyed by its tag — kept fresh each tick so the
  // service-worker message handler (registered once, outside this effect) can
  // always resolve a tag back to its "mark done" callback.
  const firesIndexRef = useRef<Map<string, Fire>>(new Map());
  // Latest fireReminder implementation, so the SW message handler (and the
  // snooze timer) always call the version with fresh mutate() functions.
  const fireReminderRef = useRef<((f: Fire) => void) | null>(null);

  // hydrate fired-set once
  useEffect(() => {
    firedRef.current = loadFired();
  }, []);

  // Register the service worker once (enables actionable, persistent OS
  // notifications via reg.showNotification — see public/sw.js). This does
  // NOT enable alarms while the app is fully closed; that needs a server
  // push service, which this project doesn't have yet.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* noop */
    });

    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; action?: string; tag?: string } | undefined;
      if (!data || data.type !== "reminder-action" || !data.tag) return;
      const fire = firesIndexRef.current.get(data.tag);
      if (!fire) return;
      if (data.action === "done") {
        fire.onDone?.();
        setActive((cur) => (cur?.key === fire.key ? null : cur));
        alarmRef.current?.stop();
      } else if (data.action === "snooze") {
        setActive((cur) => (cur?.key === fire.key ? null : cur));
        alarmRef.current?.stop();
        window.setTimeout(() => fireReminderRef.current?.(fire), 5 * 60 * 1000);
        toast.info(`Snoozed "${fire.title}" for 5 minutes`);
      } else {
        // Notification body tapped — bring the in-app reminder modal back up.
        setActive(fire);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  // Ask notification permission after first user interaction (browsers require gesture on some)
  useEffect(() => {
    if (permAskedRef.current) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const ask = () => {
      permAskedRef.current = true;
      if (Notification.permission === "default") {
        try {
          Notification.requestPermission();
        } catch {
          /* noop */
        }
      }
      window.removeEventListener("pointerdown", ask);
      window.removeEventListener("keydown", ask);
    };
    window.addEventListener("pointerdown", ask, { once: true });
    window.addEventListener("keydown", ask, { once: true });
    return () => {
      window.removeEventListener("pointerdown", ask);
      window.removeEventListener("keydown", ask);
    };
  }, []);

  // Build the list of upcoming fires from live data
  useEffect(() => {
    const doneRoutine = routineLogIndex(logs);

    const buildFires = (): Fire[] => {
      const out: Fire[] = [];
      // Tasks (need date + time, not done)
      for (const t of tasks) {
        if (t.done || !t.due_date || !t.due_time) continue;
        const when = parseAt(t.due_date, t.due_time);
        if (!when) continue;
        out.push({
          key: `task:${t.id}:${when.toISOString()}`,
          source: "task",
          id: t.id,
          title: t.title,
          when,
          meta: "To Do",
          onDone: () => updateTask.mutate({ id: t.id, done: true }),
        });
      }
      // Work nodes (need due_date + due_time, not done today)
      for (const n of nodes) {
        if (!n.due_date || !n.due_time) continue;
        if (n.done && n.done_on === today) continue;
        const when = parseAt(n.due_date, n.due_time);
        if (!when) continue;
        out.push({
          key: `work:${n.id}:${when.toISOString()}`,
          source: "work",
          id: n.id,
          title: n.title,
          when,
          meta: "Work & Projects",
          onDone: () => updateNode.mutate({ id: n.id, done: true, done_on: today }),
        });
      }
      // Routine items (daily, need time, not done today)
      for (const it of items) {
        if (!it.time) continue;
        if (doneRoutine.has(`${it.id}|${today}`)) continue;
        const when = parseAt(today, it.time);
        if (!when) continue;
        out.push({
          key: `routine:${it.id}:${when.toISOString()}`,
          source: "routine",
          id: it.id,
          title: it.title,
          when,
          meta: "Daily Routine",
          onDone: () => toggleRoutine.mutate({ item_id: it.id, log_date: today, done: true }),
        });
      }
      return out;
    };

    const fireReminder = (f: Fire) => {
      // Prefer a service-worker-backed notification: it supports action
      // buttons (Mark done / Snooze) and tends to be more persistent than a
      // plain `new Notification()`. Falls back gracefully if unavailable.
      (async () => {
        if (typeof window === "undefined" || !("Notification" in window)) return;
        if (Notification.permission !== "granted") return;
        const body = `${f.meta} • ${f.when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
        try {
          if ("serviceWorker" in navigator) {
            const reg = await navigator.serviceWorker.ready;
            await reg.showNotification(`⏰ ${f.title}`, {
              body,
              tag: f.key,
              requireInteraction: true,
              // Actions are only supported via ServiceWorkerRegistration.showNotification.
              // @ts-expect-error — actions/vibrate aren't in the lib.dom NotificationOptions type yet
              actions: [
                { action: "done", title: "✅ Mark done" },
                { action: "snooze", title: "⏰ Snooze 5m" },
              ],
              vibrate: [200, 100, 200, 100, 400],
            });
            return;
          }
        } catch {
          /* fall through to plain Notification below */
        }
        try {
          const n = new Notification(`⏰ ${f.title}`, {
            body,
            tag: f.key,
            requireInteraction: true,
          });
          n.onclick = () => {
            window.focus();
            n.close();
          };
        } catch {
          /* noop */
        }
      })();

      // Toast
      toast(`⏰ ${f.title}`, { description: f.meta, duration: 10_000 });
      // In-app modal + alarm
      alarmRef.current?.stop();
      const a = makeAlarm();
      alarmRef.current = a;
      a.start();
      setActive(f);
    };
    fireReminderRef.current = fireReminder;

    const tick = () => {
      const now = Date.now();
      const fires = buildFires();
      firesIndexRef.current = new Map(fires.map((f) => [f.key, f]));
      for (const f of fires) {
        const t = f.when.getTime();
        // Fire if in the past 90s window and not yet fired this session
        if (t <= now && now - t < 90_000 && !firedRef.current.has(f.key)) {
          firedRef.current.add(f.key);
          saveFired(firedRef.current);
          fireReminder(f);
        }
      }
    };

    tick(); // fire immediately on data change
    const iv = window.setInterval(tick, 15_000);
    return () => window.clearInterval(iv);
  }, [tasks, nodes, items, logs, today, updateTask, updateNode, toggleRoutine]);

  const dismiss = () => {
    alarmRef.current?.stop();
    alarmRef.current = null;
    setActive(null);
  };

  const markDone = () => {
    active?.onDone?.();
    dismiss();
  };

  const snooze = () => {
    if (active) {
      const f = active;
      window.setTimeout(() => fireReminderRef.current?.(f), 5 * 60 * 1000);
      toast.info(`Snoozed "${f.title}" for 5 minutes`);
    }
    dismiss();
  };

  if (!active) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-primary/40 bg-card shadow-[0_0_60px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-3 border-b border-border bg-primary/10 px-5 py-4">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/20 text-primary">
            <AlarmClock className="h-6 w-6 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{active.meta}</p>
            <p className="truncate text-sm font-semibold">Reminder</p>
          </div>
          <Button size="icon" variant="ghost" onClick={dismiss} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-2 px-5 py-6">
          <p className="text-lg font-semibold leading-snug">{active.title}</p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <BellRing className="h-4 w-4" />
            {active.when.toLocaleString(undefined, {
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>
        <div className="flex gap-2 border-t border-border p-4">
          <Button variant="outline" className="flex-1" onClick={snooze}>
            Snooze 5m
          </Button>
          <Button className="flex-1" onClick={markDone}>
            Mark done
          </Button>
        </div>
      </div>
    </div>
  );
}