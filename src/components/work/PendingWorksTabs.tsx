import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Eye,
  EyeOff,
  CheckSquare,
  StickyNote,
  HelpCircle,
  Phone,
  Target,
  Copy,
  Check,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  useTasks,
  useUpdateTask,
  useUnhideAllTasks,
  useSubtasks,
  subtasksByTask,
  useToggleSubtask,
  type Task,
  type Subtask,
} from "@/features/tasks-db";
import { useUpdateWorkNode, useUnhideAllWorkNodes, type WorkNode } from "@/features/work-db";
import { useNotes, type Note } from "@/features/notes-db";
import { GroupedLines } from "./GroupedLines";
import { HideUntilDialog } from "./WorkDialogs";
import {
  buildPendingLines,
  buildAskLines,
  buildDeactivatedLines,
  isEffectivelyHeld,
  isOverdue,
  OVERDUE_CLASS,
  type FlatLine,
  type Priority,
} from "./work-helpers";

// ---------------------------------------------------------------------------
// Self-contained readers for Asks / Client Calls / Client Leads — these tabs
// only need to *read and lightly act on* the data here (complete/hide/call),
// full management still happens on their own dedicated pages, so a light
// direct query keeps this file decoupled from those features' exact hook
// shapes.
// ---------------------------------------------------------------------------

type AskRow = {
  id: string;
  title: string;
  person_name: string | null;
  due_date: string | null;
  due_time: string | null;
  completed: boolean;
  held: boolean;
  held_until: string | null;
};

type CallRow = {
  id: string;
  name: string;
  phone: string;
  notes: string | null;
  due_date: string | null;
};

type LeadRow = {
  id: string;
  name: string;
  group_name: string | null;
  priority: "low" | "medium" | "high" | null;
  completed: boolean;
  due_date: string | null;
};

function useAsksLite() {
  return useQuery({
    queryKey: ["lifeos", "asks", "lite"],
    queryFn: async (): Promise<AskRow[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)("lifeos_asks")
        .select("id,title,person_name,due_date,due_time,completed,held,held_until")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as AskRow[];
    },
  });
}

function useCallsLite() {
  return useQuery({
    queryKey: ["lifeos", "client-calls", "lite"],
    queryFn: async (): Promise<CallRow[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)("lifeos_client_calls")
        .select("id,name,phone,notes,due_date")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CallRow[];
    },
  });
}

function useLeadsLite() {
  return useQuery({
    queryKey: ["lifeos", "client-leads", "lite"],
    queryFn: async (): Promise<LeadRow[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)("lifeos_client_leads")
        .select("id,name,group_name,priority,completed,due_date")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LeadRow[];
    },
  });
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Tab persistence
// ---------------------------------------------------------------------------

const TAB_OPTIONS = [
  "all",
  "shown",
  "todo",
  "notes",
  "asks",
  "calls",
  "leads",
  "hidden",
  "deactivated",
] as const;
type PendingTab = (typeof TAB_OPTIONS)[number];
const TAB_KEY = "lifeos:work:pending-tab";

function loadPendingTab(): PendingTab {
  if (typeof window === "undefined") return "all";
  try {
    const v = localStorage.getItem(TAB_KEY);
    if ((TAB_OPTIONS as readonly string[]).includes(v ?? "")) return v as PendingTab;
  } catch {
    /* ignore */
  }
  return "all";
}

function savePendingTab(v: PendingTab) {
  try {
    localStorage.setItem(TAB_KEY, v);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// To-Do list renderer — now actually shows sub-tasks under each main task.
// ---------------------------------------------------------------------------

function TodoSection({
  list,
  today,
  subtaskMap,
  onToggleSubtask,
  onHide,
}: {
  list: Task[];
  today: string;
  subtaskMap: Map<string, Subtask[]>;
  onToggleSubtask: (id: string, done: boolean) => void;
  onHide: (t: Task) => void;
}) {
  const updateTask = useUpdateTask();

  if (list.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <CheckSquare className="h-4 w-4 text-accent" />
        <p className="text-sm font-semibold">To Do List</p>
        <span className="text-xs text-muted-foreground">· {list.length}</span>
      </div>
      <div className="space-y-1.5">
        {list.map((t) => {
          const isHeld = isEffectivelyHeld(t.held, t.held_until);
          const overdue = isOverdue(t.due_date, false, today);
          const subs = subtaskMap.get(t.id) ?? [];
          return (
            <div
              key={t.id}
              onClick={() => updateTask.mutate({ id: t.id, done: true })}
              className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-xs sm:text-sm hover:bg-accent/30"
            >
              <Checkbox
                checked={false}
                onCheckedChange={() => updateTask.mutate({ id: t.id, done: true })}
                onClick={(e) => e.stopPropagation()}
                className="mt-0.5 shrink-0"
              />
              <div className="min-w-0 flex-1">
                {isHeld ? (
                  <span
                    className="inline-block h-3.5 w-40 max-w-full rounded bg-muted-foreground/15"
                    aria-label="Hidden"
                  />
                ) : (
                  <>
                    <span className="break-words leading-snug">
                      <span
                        className={cn(
                          "font-medium",
                          overdue ? cn(OVERDUE_CLASS, "font-semibold") : "text-foreground",
                        )}
                      >
                        {t.title}
                      </span>
                      {(t.due_date || t.due_time) && (
                        <span
                          className={cn(
                            "ml-2 text-xs",
                            overdue ? cn(OVERDUE_CLASS, "font-medium") : "text-muted-foreground",
                          )}
                        >
                          {t.due_date ?? ""}
                          {t.due_time ? ` · ${t.due_time}` : ""}
                          {overdue && " · Overdue"}
                        </span>
                      )}
                    </span>
                    {/* Sub-tasks — this is the actual fix: they were never
                        fetched/rendered here before. */}
                    {subs.length > 0 && (
                      <ul className="mt-1 space-y-1" onClick={(e) => e.stopPropagation()}>
                        {subs.map((s) => (
                          <li key={s.id} className="flex items-center gap-1.5 pl-1">
                            <Checkbox
                              checked={s.done}
                              onCheckedChange={(v) => onToggleSubtask(s.id, !!v)}
                              className="h-3.5 w-3.5 shrink-0"
                            />
                            <span
                              className={cn(
                                "text-xs text-muted-foreground",
                                s.done && "line-through",
                              )}
                            >
                              {s.title}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isHeld) {
                    updateTask.mutate({ id: t.id, held: false, held_until: null });
                  } else {
                    onHide(t);
                  }
                }}
                className="shrink-0 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                {isHeld ? (
                  <>
                    <Eye className="h-3.5 w-3.5" /> Show
                  </>
                ) : (
                  <>
                    <EyeOff className="h-3.5 w-3.5" /> Hide
                  </>
                )}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notes tab
// ---------------------------------------------------------------------------

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={async (e) => {
        e.stopPropagation();
        const ok = await copyToClipboard(text);
        if (ok) {
          setCopied(true);
          toast.success("Copied to clipboard");
          window.setTimeout(() => setCopied(false), 1500);
        } else {
          toast.error("Couldn't copy");
        }
      }}
      className="shrink-0 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

function NotesTab() {
  const { data: notes = [] } = useNotes();
  const groups = useMemo(() => {
    const m = new Map<string, Note[]>();
    for (const n of notes) {
      const key = n.category?.trim() || "Uncategorized";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(n);
    }
    return m;
  }, [notes]);

  if (notes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No notes yet — add one from the Notes page.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([category, items]) => (
        <div key={category} className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">{category}</p>
            <span className="text-xs text-muted-foreground">· {items.length}</span>
          </div>
          <div className="space-y-1.5">
            {items.map((n) => (
              <div
                key={n.id}
                className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/30"
              >
                <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="break-words font-medium">{n.title}</p>
                  {n.description && (
                    <p className="mt-0.5 break-words text-xs text-muted-foreground">
                      {n.description}
                    </p>
                  )}
                </div>
                {n.description && <CopyBtn text={n.description} />}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Asks tab
// ---------------------------------------------------------------------------

function AsksTab({ today, byParent }: { today: string; byParent: Map<string | null, WorkNode[]> }) {
  const { data: asks = [] } = useAsksLite();
  const visible = asks.filter((a) => !a.completed && !isEffectivelyHeld(a.held, a.held_until));
  const workAskLines = useMemo(() => buildAskLines(byParent, today), [byParent, today]);

  if (visible.length === 0 && workAskLines.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Nothing pending in Asks.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {workAskLines.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">From Work &amp; Projects</p>
            <span className="text-xs text-muted-foreground">· {workAskLines.length}</span>
          </div>
          <p className="mb-2 text-xs text-muted-foreground">
            Managed from Work &amp; Projects — edit or un-mark there, not here.
          </p>
          <div className="space-y-1.5">
            {workAskLines.map(({ path, leaf }) => {
              const overdue = isOverdue(leaf.due_date, false, today);
              return (
                <div
                  key={path.map((p) => p.id).join(">")}
                  className="rounded-lg px-2 py-1.5 text-sm"
                >
                  <p className={cn("font-medium", overdue && cn(OVERDUE_CLASS, "font-semibold"))}>
                    {path.map((n) => n.title).join(" › ")}
                  </p>
                  {(leaf.ask_person_name || leaf.due_date) && (
                    <p className="text-xs text-muted-foreground">
                      {leaf.ask_person_name && <>from {leaf.ask_person_name} · </>}
                      {leaf.due_date}
{leaf.due_time ? ` · ${leaf.due_time}` : ""}
                      {overdue && " · Overdue"}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {visible.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Asks</p>
            <span className="text-xs text-muted-foreground">· {visible.length}</span>
          </div>
          <div className="space-y-1.5">
            {visible.map((a) => {
              const overdue = !!a.due_date && a.due_date < today;
              return (
                <div key={a.id} className="rounded-lg px-2 py-1.5 text-sm">
                  <p className={cn("font-medium", overdue && cn(OVERDUE_CLASS, "font-semibold"))}>
                    {a.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.person_name && <>from {a.person_name} · </>}
                    {a.due_date}
                    {a.due_time ? ` · ${a.due_time}` : ""}
                    {overdue && " · Overdue"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calls tab
// ---------------------------------------------------------------------------

function CallsTab() {
  const { data: calls = [] } = useCallsLite();

  if (calls.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No client calls saved yet.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <Phone className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">Client Calls</p>
        <span className="text-xs text-muted-foreground">· {calls.length}</span>
      </div>
      <div className="space-y-1.5">
        {calls.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm"
          >
            <div className="min-w-0">
              <p className="font-medium">{c.name}</p>
              {c.notes && <p className="text-xs text-muted-foreground">{c.notes}</p>}
            </div>
            <a
              href={`tel:${c.phone.replace(/\s+/g, "")}`}
              className="shrink-0 text-primary hover:underline"
            >
              {c.phone}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Leads tab
// ---------------------------------------------------------------------------

function LeadsTab() {
  const { data: leads = [] } = useLeadsLite();
  const visible = leads.filter((l) => !l.completed);
  const groups = useMemo(() => {
    const m = new Map<string, LeadRow[]>();
    for (const l of visible) {
      const key = l.group_name?.trim() || "Ungrouped";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(l);
    }
    return m;
  }, [visible]);

  if (visible.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No open client leads.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([group, items]) => (
        <div key={group} className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">{group}</p>
            <span className="text-xs text-muted-foreground">· {items.length}</span>
          </div>
          <div className="space-y-1.5">
            {items.map((l) => (
              <p key={l.id} className="rounded-lg px-2 py-1.5 text-sm font-medium">
                {l.name}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Deactivated tab
// ---------------------------------------------------------------------------

function DeactivatedGroups({
  lines,
  onToggleDeactivate,
}: {
  lines: FlatLine[];
  onToggleDeactivate: (n: WorkNode) => void;
}) {
  const groups = new Map<string, FlatLine[]>();
  for (const l of lines) {
    const key = l.path[0].id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(l);
  }

  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([companyId, items]) => {
        const company = items[0].path[0];
        return (
          <div key={companyId} className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <p className="text-sm font-semibold">{company.title}</p>
              <span className="text-xs text-muted-foreground">· {items.length}</span>
            </div>
            <div className="space-y-1.5">
              {items.map(({ path, leaf }) => (
                <div
                  key={path.map((p) => p.id).join(">")}
                  className="flex items-start justify-between gap-2 rounded-lg px-2 py-1.5 text-sm"
                >
                  <span className="min-w-0 break-words text-muted-foreground">
                    {path.map((n) => n.title).join(" › ")}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="shrink-0 gap-1 px-2 text-xs"
                    onClick={() => onToggleDeactivate(leaf)}
                  >
                    Activate
                  </Button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main tabbed Pending Works view
// ---------------------------------------------------------------------------

export function PendingWorksTabs({
  byParent,
  today,
  onToggleDone,
  onSetPriority,
  onToggleDeactivate,
}: {
  byParent: Map<string | null, WorkNode[]>;
  today: string;
  onToggleDone: (n: WorkNode) => void;
  onSetPriority: (n: WorkNode, p: Priority) => void;
  onToggleDeactivate: (n: WorkNode) => void;
}) {
  const [tab, setTab] = useState<PendingTab>(loadPendingTab);
  useEffect(() => {
    savePendingTab(tab);
  }, [tab]);

  const deactivatedLines = useMemo(() => buildDeactivatedLines(byParent), [byParent]);

  const lines = useMemo(() => buildPendingLines(byParent, today), [byParent, today]);
  const shownLines = useMemo(
    () => lines.filter((l) => !isEffectivelyHeld(l.leaf.held, l.leaf.held_until)),
    [lines],
  );
  const hiddenLines = useMemo(
() => lines.filter((l) => isEffectivelyHeld(l.leaf.held, l.leaf.held_until)),
    [lines],
  );

  const updateNode = useUpdateWorkNode();
  const unhideAllWork = useUnhideAllWorkNodes();
  const unhideAllTasks = useUnhideAllTasks();
  const [hidingNode, setHidingNode] = useState<WorkNode | null>(null);
  const [hidingTask, setHidingTask] = useState<Task | null>(null);

  const onToggleHoldNode = (n: WorkNode) => {
    if (isEffectivelyHeld(n.held, n.held_until)) {
      updateNode.mutate({ id: n.id, held: false, held_until: null });
    } else {
      setHidingNode(n);
    }
  };

  const { data: tasks = [] } = useTasks();
  const updateTask = useUpdateTask();
  const { data: subtasks = [] } = useSubtasks();
  const toggleSubtask = useToggleSubtask();
  const subtaskMap = useMemo(() => subtasksByTask(subtasks), [subtasks]);

  const relevantTasks = useMemo(
    () => tasks.filter((t) => !t.done && (!t.due_date || t.due_date <= today)),
    [tasks, today],
  );
  const shownTasks = useMemo(
    () => relevantTasks.filter((t) => !isEffectivelyHeld(t.held, t.held_until)),
    [relevantTasks],
  );
  const hiddenTasks = useMemo(
    () => relevantTasks.filter((t) => isEffectivelyHeld(t.held, t.held_until)),
    [relevantTasks],
  );

  const totalHidden = hiddenLines.length + hiddenTasks.length;
  const showAllHidden = () => {
    const workIds = hiddenLines.map((l) => l.leaf.id);
    const taskIds = hiddenTasks.map((t) => t.id);
    if (workIds.length) unhideAllWork.mutate(workIds);
    if (taskIds.length) unhideAllTasks.mutate(taskIds);
  };

  const nothingAtAll = lines.length === 0 && relevantTasks.length === 0;

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as PendingTab)}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="shown">Shown ({shownLines.length})</TabsTrigger>
          <TabsTrigger value="todo">To Do List ({shownTasks.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="asks">Asks</TabsTrigger>
          <TabsTrigger value="calls">Calls</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="hidden">Hidden ({totalHidden})</TabsTrigger>
          <TabsTrigger value="deactivated">Deactivated ({deactivatedLines.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "hidden" && totalHidden > 0 && (
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={showAllHidden}>
          <Eye className="h-3.5 w-3.5" /> Show all hidden ({totalHidden})
        </Button>
      )}

      {tab === "all" &&
        (nothingAtAll ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            🎉 Nothing pending. All items completed.
          </div>
        ) : (
          <>
            {shownLines.length > 0 && (
              <GroupedLines
                lines={shownLines}
                checked={false}
                today={today}
                sectionLabel="shown"
                onToggle={onToggleDone}
                onSetPriority={onSetPriority}
                onToggleHold={onToggleHoldNode}
              />
            )}
            <TodoSection
              list={shownTasks}
              today={today}
              subtaskMap={subtaskMap}
              onToggleSubtask={(id, done) => toggleSubtask.mutate({ id, done })}
              onHide={setHidingTask}
            />
          </>
        ))}

      {tab === "shown" &&
        (shownLines.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nothing shown right now.
          </div>
        ) : (
          <GroupedLines
            lines={shownLines}
            checked={false}
            today={today}
            sectionLabel="shown"
            onToggle={onToggleDone}
            onSetPriority={onSetPriority}
            onToggleHold={onToggleHoldNode}
          />
        ))}

      {tab === "todo" && (
        <TodoSection
          list={shownTasks}
          today={today}
          subtaskMap={subtaskMap}
          onToggleSubtask={(id, done) => toggleSubtask.mutate({ id, done })}
          onHide={setHidingTask}
        />
      )}

      {tab === "notes" && <NotesTab />}
      {tab === "asks" && <AsksTab today={today} byParent={byParent} />}
      {tab === "calls" && <CallsTab />}
      {tab === "leads" && <LeadsTab />}

      {tab === "hidden" &&
        (totalHidden === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nothing hidden right now.
          </div>
        ) : (
          <div className="space-y-4">
            {hiddenLines.length > 0 && (
              <GroupedLines
                lines={hiddenLines}
                checked={false}
                today={today}
                sectionLabel="hidden"
                onToggle={onToggleDone}
                onSetPriority={onSetPriority}
                onToggleHold={onToggleHoldNode}
              />
            )}
            <TodoSection
              list={hiddenTasks}
              today={today}
              subtaskMap={subtaskMap}
              onToggleSubtask={(id, done) => toggleSubtask.mutate({ id, done })}
              onHide={setHidingTask}
            />
          </div>
        ))}

      {tab === "deactivated" &&
        (deactivatedLines.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nothing deactivated right now.
          </div>
        ) : (
          <DeactivatedGroups lines={deactivatedLines} onToggleDeactivate={onToggleDeactivate} />
        ))}

      <HideUntilDialog
        open={!!hidingNode}
        itemTitle={hidingNode?.title ?? ""}
        onClose={() => setHidingNode(null)}
        onConfirm={(untilIso) => {
          if (hidingNode)
            updateNode.mutate({ id: hidingNode.id, held: true, held_until: untilIso });
          setHidingNode(null);
        }}
      />
      <HideUntilDialog
        open={!!hidingTask}
        itemTitle={hidingTask?.title ?? ""}
        onClose={() => setHidingTask(null)}
        onConfirm={(untilIso) => {
          if (hidingTask)
            updateTask.mutate({ id: hidingTask.id, held: true, held_until: untilIso });
          setHidingTask(null);
        }}
      />
    </div>
  );
}