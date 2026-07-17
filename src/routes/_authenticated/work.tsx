import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronRight,
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  StickyNote,
  Building2,
  FolderKanban,
  ListChecks,
  CheckSquare,
  Eye,
  EyeOff,
  Clock,
  CheckCircle2,
  ArrowLeft,
  RotateCcw,
  Target,
  Phone,
} from "lucide-react";

import { toast } from "sonner";
import { PageHeader, RowActions } from "@/components/ui-bits";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { logicalTodayKey } from "@/lib/storage";
import {
  useWorkNodes,
  useCreateWorkNode,
  useUpdateWorkNode,
  useDeleteWorkNode,
  useReorderWorkNodes,
  useResetAllWorkNodes,
  type WorkNode,
} from "@/features/work-db";
import { useTasks, useUpdateTask, type Task } from "@/features/tasks-db";

export const Route = createFileRoute("/_authenticated/work")({
  ssr: false,
  component: WorkPage,
});

const TYPE_META = [
  { key: "company", label: "Company", icon: Building2, color: "text-primary" },
  { key: "category", label: "Category", icon: FolderKanban, color: "text-accent" },
  { key: "work", label: "Work", icon: ListChecks, color: "text-foreground" },
  { key: "task", label: "Task", icon: CheckSquare, color: "text-muted-foreground" },
] as const;

function iconFor(depth: number) {
  const m = TYPE_META[Math.min(depth, TYPE_META.length - 1)];
  return m;
}

const PRIORITY_META = {
  low: { label: "Low", textClass: "text-sky-600 dark:text-sky-400", dotClass: "bg-sky-500" },
  medium: {
    label: "Medium",
    textClass: "text-amber-700/70 dark:text-amber-300/60",
    dotClass: "bg-amber-500/50",
  },
  high: { label: "High", textClass: "text-red-600 dark:text-red-400", dotClass: "bg-red-500" },
} as const;

type Priority = "low" | "medium" | "high" | null;

/** No priority set → default/foreground text color ("white"). Any of the
 * three explicit levels gets its own color, including Medium. */
function priorityTextClass(priority: Priority) {
  return priority ? PRIORITY_META[priority].textClass : "";
}

function PriorityPicker({ value, onChange }: { value: Priority; onChange: (v: Priority) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant={value === null ? "default" : "outline"}
        onClick={() => onChange(null)}
        className="flex-1"
      >
        None
      </Button>
      {(["low", "medium", "high"] as const).map((p) => (
        <Button
          key={p}
          type="button"
          size="sm"
          variant={value === p ? "default" : "outline"}
          onClick={() => onChange(p)}
          className="flex-1"
        >
          {PRIORITY_META[p].label}
        </Button>
      ))}
    </div>
  );
}

/** A small always-visible control to change priority in one click/tap,
 * without opening the full Edit dialog. */
function QuickPriorityMenu({
  value,
  onChange,
}: {
  value: Priority;
  onChange: (v: Priority) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label={
            value ? `Priority: ${PRIORITY_META[value].label}. Change priority` : "Set priority"
          }
          title={value ? `Priority: ${PRIORITY_META[value].label}` : "Set priority"}
          className={cn(
            "shrink-0 h-2.5 w-2.5 rounded-full border transition-colors",
            value
              ? cn(PRIORITY_META[value].dotClass, "border-transparent")
              : "border-muted-foreground/40 hover:border-foreground",
          )}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => onChange(null)}>None</DropdownMenuItem>
        {(["low", "medium", "high"] as const).map((p) => (
          <DropdownMenuItem
            key={p}
            onClick={() => onChange(p)}
            className={PRIORITY_META[p].textClass}
          >
            {PRIORITY_META[p].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Thu, 17 Jul 2026 · 4:30 PM" style line for a node's due date/time, or
 * null if neither is set. */
function formatDueLine(n: { due_date: string | null; due_time: string | null }): string | null {
  if (!n.due_date && !n.due_time) return null;
  const parts: string[] = [];
  if (n.due_date) {
    const d = new Date(n.due_date + "T00:00:00");
    parts.push(
      `${WEEKDAYS[d.getDay()]}, ${d.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}`,
    );
  }
  if (n.due_time) {
    const [h, m] = n.due_time.split(":");
    const dt = new Date();
    dt.setHours(Number(h), Number(m), 0, 0);
    parts.push(dt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }));
  }
  return parts.join(" · ");
}

/** A node counts as "done" only for today's date — it resets automatically
 * once done_on stops matching today. (One-time tasks never actually reach
 * this state for long: marking one done deletes it outright — see
 * toggleDone below — so this only really matters for recurring items.) */
function isNodeDone(n: WorkNode, today: string) {
  return n.done && n.done_on === today;
}

type ViewMode = "tree" | "pending" | "completed";
const VIEW_KEY = "lifeos:work:view";

function loadView(): ViewMode {
  if (typeof window === "undefined") return "tree";
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === "tree" || v === "pending" || v === "completed") return v;
  } catch {
    /* ignore */
  }
  return "tree";
}

function saveView(v: ViewMode) {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    /* ignore */
  }
}

function WorkPage() {
  const { data: nodes = [] } = useWorkNodes();
  const create = useCreateWorkNode();
  const update = useUpdateWorkNode();
  const del = useDeleteWorkNode();
  const reorder = useReorderWorkNodes();
  const resetAll = useResetAllWorkNodes();

  const [newCompany, setNewCompany] = useState("");
  const [editing, setEditing] = useState<WorkNode | null>(null);
  const [addingUnder, setAddingUnder] = useState<{ parent: WorkNode | null; depth: number } | null>(
    null,
  );
  const [addTitle, setAddTitle] = useState("");
  const addTitleInputRef = useRef<HTMLInputElement>(null);
  const [addKind, setAddKind] = useState<"recurring" | "one_time">("recurring");
  const [addPriority, setAddPriority] = useState<Priority>(null);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [addDueDate, setAddDueDate] = useState("");
  const [addDueTime, setAddDueTime] = useState("");
  const COLLAPSE_KEY = "lifeos:work:collapsed";
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(COLLAPSE_KEY);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });
  const persistCollapsed = (s: Set<string>) => {
    try {
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...s]));
    } catch {}
  };
  const today = logicalTodayKey();

  const [view, setView] = useState<ViewMode>(loadView);
  const changeView = (v: ViewMode) => {
    setView(v);
    saveView(v);
  };

  const byParent = useMemo(() => {
    const m = new Map<string | null, WorkNode[]>();
    for (const n of nodes) {
      const k = n.parent_id;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(n);
    }
    for (const [, arr] of m) arr.sort((a, b) => a.sort_order - b.sort_order);
    return m;
  }, [nodes]);

  const roots = byParent.get(null) ?? [];

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      persistCollapsed(n);
      return n;
    });
  };

  const addCompany = () => {
    const t = newCompany.trim();
    if (!t) return;
    create.mutate(
      { parent_id: null, title: t, node_type: "company", sort_order: roots.length },
      { onSuccess: () => setNewCompany("") },
    );
  };

  const submitAdd = (keepOpen: boolean) => {
    const t = addTitle.trim();
    if (!t || !addingUnder) return;
    const parent = addingUnder.parent;
    const siblings = byParent.get(parent?.id ?? null) ?? [];
    const type = TYPE_META[Math.min(addingUnder.depth, TYPE_META.length - 1)].key;
    const canBeOneTime = addingUnder.depth >= 2; // work or task
    create.mutate(
      {
        parent_id: parent?.id ?? null,
        title: t,
        node_type: type,
        sort_order: siblings.length,
        task_kind: canBeOneTime ? addKind : "recurring",
        priority: addPriority,
        due_date: canBeOneTime && addDueDate ? addDueDate : null,
        due_time: canBeOneTime && addDueTime ? `${addDueTime}:00` : null,
      },
      {
        onSuccess: () => {
          setAddTitle("");
          setAddKind("recurring");
          setAddPriority(null);
          setShowPriorityPicker(false);
          setAddDueDate("");
          setAddDueTime("");
          if (keepOpen) {
            toast.success("Added — ready for the next one");
            addTitleInputRef.current?.focus();
          } else {
            setAddingUnder(null);
            toast.success("Added");
          }
        },
      },
    );
  };

  const toggleDone = (n: WorkNode) => {
    const currentlyDone = isNodeDone(n, today);
    // One-time item: marking it done removes it (and its children) entirely —
    // it should not linger struck-through like a recurring item.
    if (!currentlyDone && n.task_kind === "one_time") {
      del.mutate(n.id, { onSuccess: () => toast.success("Completed & removed") });
      return;
    }
    update.mutate({
      id: n.id,
      done: !currentlyDone,
      done_on: !currentlyDone ? today : null,
    });
  };

  const setPriority = (n: WorkNode, p: Priority) => {
    update.mutate({ id: n.id, priority: p });
  };

  const toggleHold = (n: WorkNode) => {
    update.mutate({ id: n.id, held: !n.held });
  };

  const doneCount = nodes.filter((n) => isNodeDone(n, today)).length;
  const pendingCount = useMemo(() => buildPendingLines(byParent, today).length, [byParent, today]);
  const completedCount = useMemo(
    () => buildCompletedLines(byParent, today).length,
    [byParent, today],
  );

  const resetEverything = () => {
    const ids = nodes.filter((n) => n.done).map((n) => n.id);
    if (ids.length === 0) {
      toast.info("Nothing to reset — everything is already pending.");
      return;
    }
    if (
      confirm(`Reset ${ids.length} completed item${ids.length === 1 ? "" : "s"} back to pending?`)
    ) {
      resetAll.mutate(ids);
    }
  };

  const headerTitle =
    view === "pending"
      ? "Pending Works"
      : view === "completed"
        ? "Completed Works"
        : "Work & Projects";
  const headerSubtitle =
    view === "pending"
      ? "Only incomplete items. Tick to mark done. A completed parent hides its children."
      : view === "completed"
        ? "Everything marked done. Untick to move an item back to Pending Works."
        : "Companies → categories → works → tasks. Drag to reorder within a group.";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title={headerTitle} subtitle={headerSubtitle} />
        <div className="flex flex-wrap gap-1.5">
          {view === "tree" && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 px-2.5 text-xs"
                onClick={() => changeView("pending")}
              >
                <Eye className="h-3.5 w-3.5" /> Pending ({pendingCount})
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 px-2.5 text-xs"
                onClick={() => changeView("completed")}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Completed ({completedCount})
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 px-2.5 text-xs"
                onClick={resetEverything}
                title="Move all completed items back to pending"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset ({doneCount})
              </Button>
            </>
          )}
          {view === "pending" && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 px-2.5 text-xs"
                onClick={() => changeView("tree")}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 px-2.5 text-xs"
                onClick={() => changeView("completed")}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Completed ({completedCount})
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 px-2.5 text-xs"
                onClick={resetEverything}
                title="Move all completed items back to pending"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset ({doneCount})
              </Button>
            </>
          )}
          {view === "completed" && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 px-2.5 text-xs"
                onClick={() => changeView("tree")}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 px-2.5 text-xs"
                onClick={() => changeView("pending")}
              >
                <Eye className="h-3.5 w-3.5" /> Pending ({pendingCount})
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 px-2.5 text-xs"
                onClick={resetEverything}
                title="Move all completed items back to pending"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset ({doneCount})
              </Button>
            </>
          )}
        </div>
      </div>

      {view === "pending" && (
        <PendingList
          byParent={byParent}
          today={today}
          onToggleDone={toggleDone}
          onSetPriority={setPriority}
          onToggleHold={toggleHold}
        />
      )}

      {view === "completed" && (
        <CompletedList
          byParent={byParent}
          today={today}
          onToggleDone={toggleDone}
          onSetPriority={setPriority}
        />
      )}

      {view === "tree" && (
        <>
          <div className="flex flex-wrap gap-2">
            <Link to="/client-leads">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Target className="h-3.5 w-3.5" /> Client Leads
              </Button>
            </Link>
            <Link to="/client-calls">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Phone className="h-3.5 w-3.5" /> Client Calls
              </Button>
            </Link>
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 sm:flex-row">
            <Input
              value={newCompany}
              onChange={(e) => setNewCompany(e.target.value)}
              placeholder="Add company (e.g. KCT, BMW, Pivot Marketing)"
              onKeyDown={(e) => e.key === "Enter" && addCompany()}
            />
            <Button onClick={addCompany} className="gap-2">
              <Plus className="h-4 w-4" /> Add Company
            </Button>
          </div>

          <div className="space-y-3">
            {roots.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No companies yet. Add one above to get started.
              </div>
            )}

            <TreeLevel
              parentId={null}
              depth={0}
              byParent={byParent}
              collapsed={collapsed}
              onToggleCollapse={toggleCollapse}
              onAddChild={(parent, depth) => {
                setAddingUnder({ parent, depth });
                setAddTitle("");
              }}
              onEdit={setEditing}
              onDelete={(n) => {
                if (confirm(`Delete "${n.title}" and everything under it?`)) del.mutate(n.id);
              }}
              onToggleDone={toggleDone}
              onSetPriority={setPriority}
              today={today}
              onReorderSiblings={(parent_id, ids) => {
                const rows = ids.map((id, i) => ({ id, sort_order: i, parent_id }));
                reorder.mutate(rows);
              }}
            />
          </div>
        </>
      )}

      {/* Add child dialog */}
      <Dialog open={!!addingUnder} onOpenChange={(o) => !o && setAddingUnder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add {addingUnder ? iconFor(addingUnder.depth).label : "item"}
              {addingUnder?.parent ? ` under "${addingUnder.parent.title}"` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              autoFocus
              ref={addTitleInputRef}
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitAdd(false)}
              placeholder="e.g. Project Development"
            />
          </div>
          <div className="space-y-2 pt-2">
            {showPriorityPicker ? (
              <>
                <Label>Priority</Label>
                <PriorityPicker value={addPriority} onChange={setAddPriority} />
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowPriorityPicker(true)}
                className="text-xs text-primary hover:underline"
              >
                + Set priority (optional)
              </button>
            )}
          </div>
          {addingUnder && addingUnder.depth >= 2 && (
            <div className="space-y-2 pt-2">
              <Label>Type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={addKind === "recurring" ? "default" : "outline"}
                  onClick={() => setAddKind("recurring")}
                  className="flex-1"
                >
                  🔁 Recurring (daily)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={addKind === "one_time" ? "default" : "outline"}
                  onClick={() => setAddKind("one_time")}
                  className="flex-1"
                >
                  ✅ One-time
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {addKind === "recurring"
                  ? "Resets to uncompleted each day."
                  : "Removed automatically once marked done."}
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div className="space-y-1">
                  <Label className="text-xs">Due date (optional)</Label>
                  <Input
                    type="date"
                    value={addDueDate}
                    onChange={(e) => setAddDueDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Time (optional)</Label>
                  <Input
                    type="time"
                    value={addDueTime}
                    onChange={(e) => setAddDueTime(e.target.value)}
                  />
                </div>
              </div>
              {addDueDate && addDueTime && (
                <p className="text-xs text-primary">⏰ You'll be reminded at that time.</p>
              )}
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setAddingUnder(null);
                setAddPriority(null);
                setShowPriorityPicker(false);
              }}
            >
              Cancel
            </Button>
            <Button variant="outline" onClick={() => submitAdd(true)}>
              Save &amp; Add
            </Button>
            <Button onClick={() => submitAdd(false)}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit</DialogTitle>
          </DialogHeader>
          {editing && (
            <EditForm
              node={editing}
              onSubmit={(patch) => {
                update.mutate({ id: editing.id, ...patch }, { onSuccess: () => setEditing(null) });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditForm({
  node,
  onSubmit,
}: {
  node: WorkNode;
  onSubmit: (patch: {
    title: string;
    notes: string | null;
    task_kind: "recurring" | "one_time";
    priority: Priority;
    due_date: string | null;
    due_time: string | null;
  }) => void;
}) {
  const [title, setTitle] = useState(node.title);
  const [notes, setNotes] = useState(node.notes ?? "");
  const [kind, setKind] = useState<"recurring" | "one_time">(node.task_kind ?? "recurring");
  const [priority, setPriority] = useState<Priority>(node.priority ?? null);
  const [dueDate, setDueDate] = useState(node.due_date ?? "");
  const [dueTime, setDueTime] = useState(node.due_time ? node.due_time.slice(0, 5) : "");
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>Notes / Remarks</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Add any details, amounts, statuses…"
        />
      </div>
      <div className="space-y-1">
        <Label>Priority</Label>
        <PriorityPicker value={priority} onChange={setPriority} />
      </div>
      <div className="space-y-1">
        <Label>Type</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={kind === "recurring" ? "default" : "outline"}
            onClick={() => setKind("recurring")}
            className="flex-1"
          >
            🔁 Recurring
          </Button>
          <Button
            type="button"
            size="sm"
            variant={kind === "one_time" ? "default" : "outline"}
            onClick={() => setKind("one_time")}
            className="flex-1"
          >
            ✅ One-time
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Due date (optional)</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Time (optional)</Label>
          <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
        </div>
      </div>
      {dueDate && dueTime && (
        <p className="text-xs text-primary">⏰ You'll be reminded at that time.</p>
      )}
      <DialogFooter>
        <Button
          onClick={() =>
            onSubmit({
              title: title.trim() || node.title,
              notes: notes.trim() || null,
              task_kind: kind,
              priority,
              due_date: dueDate || null,
              due_time: dueTime ? `${dueTime}:00` : null,
            })
          }
        >
          Save
        </Button>
      </DialogFooter>
    </div>
  );
}

function TreeLevel({
  parentId,
  depth,
  byParent,
  collapsed,
  onToggleCollapse,
  onAddChild,
  onEdit,
  onDelete,
  onToggleDone,
  onSetPriority,
  onReorderSiblings,
  today,
}: {
  parentId: string | null;
  depth: number;
  byParent: Map<string | null, WorkNode[]>;
  collapsed: Set<string>;
  onToggleCollapse: (id: string) => void;
  onAddChild: (parent: WorkNode | null, depth: number) => void;
  onEdit: (n: WorkNode) => void;
  onDelete: (n: WorkNode) => void;
  onToggleDone: (n: WorkNode) => void;
  onSetPriority: (n: WorkNode, p: Priority) => void;
  onReorderSiblings: (parent_id: string | null, ids: string[]) => void;
  today: string;
}) {
  const items = byParent.get(parentId) ?? [];
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => i.id === active.id);
    const newIdx = items.findIndex((i) => i.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(items, oldIdx, newIdx);
    onReorderSiblings(
      parentId,
      next.map((i) => i.id),
    );
  };

  if (items.length === 0) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div
          className={cn(
            "space-y-2",
            depth > 0 && "ml-2 border-l border-border/60 pl-2 sm:ml-4 sm:pl-4",
          )}
        >
          {items.map((n) => (
            <NodeRow
              key={n.id}
              node={n}
              depth={depth}
              hasChildren={(byParent.get(n.id) ?? []).length > 0}
              collapsedOpen={!collapsed.has(n.id)}
              onToggleCollapse={() => onToggleCollapse(n.id)}
              onAddChild={() => onAddChild(n, depth + 1)}
              onEdit={() => onEdit(n)}
              onDelete={() => onDelete(n)}
              onToggleDone={() => onToggleDone(n)}
              onSetPriority={(p) => onSetPriority(n, p)}
              effectiveDone={isNodeDone(n, today)}
            >
              {!collapsed.has(n.id) && (
                <TreeLevel
                  parentId={n.id}
                  depth={depth + 1}
                  byParent={byParent}
                  collapsed={collapsed}
                  onToggleCollapse={onToggleCollapse}
                  onAddChild={onAddChild}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggleDone={onToggleDone}
                  onSetPriority={onSetPriority}
                  onReorderSiblings={onReorderSiblings}
                  today={today}
                />
              )}
            </NodeRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function NodeRow({
  node,
  depth,
  hasChildren,
  collapsedOpen,
  onToggleCollapse,
  onAddChild,
  onEdit,
  onDelete,
  onToggleDone,
  onSetPriority,
  effectiveDone,
  children,
}: {
  node: WorkNode;
  depth: number;
  hasChildren: boolean;
  collapsedOpen: boolean;
  onToggleCollapse: () => void;
  onAddChild: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleDone: () => void;
  onSetPriority: (p: Priority) => void;
  effectiveDone: boolean;
  children?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const meta = iconFor(depth);
  const Icon = meta.icon;
  const nextMeta = iconFor(depth + 1);
  const dueLine = formatDueLine(node);

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={cn(
          "group flex items-start gap-1.5 rounded-xl border border-border bg-card p-2.5 transition-colors hover:bg-accent/20 sm:gap-2",
          depth === 0 && "bg-gradient-to-r from-primary/5 to-transparent",
        )}
      >
        <button
          {...attributes}
          {...listeners}
          className="mt-1 shrink-0 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Drag"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <button
          onClick={onToggleCollapse}
          className={cn(
            "mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent/40",
            !hasChildren && "invisible",
          )}
          aria-label="Toggle"
        >
          <ChevronRight
            className={cn("h-4 w-4 transition-transform", collapsedOpen && "rotate-90")}
          />
        </button>

        <Checkbox
          checked={effectiveDone}
          onCheckedChange={onToggleDone}
          className="mt-1 shrink-0"
        />

        <Icon className={cn("mt-1 h-4 w-4 shrink-0", meta.color)} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p
              className={cn(
                "break-words text-sm font-medium leading-snug",
                depth === 0 && "text-base font-semibold",
                effectiveDone
                  ? "text-muted-foreground line-through"
                  : priorityTextClass(node.priority),
              )}
            >
              {node.title}
            </p>
            {node.task_kind === "one_time" && (
              <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                One-time
              </span>
            )}
            <QuickPriorityMenu value={node.priority} onChange={(p) => onSetPriority(p)} />
          </div>
          {dueLine && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3 shrink-0" />
              {dueLine}
            </p>
          )}
          {node.notes && (
            <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
              <StickyNote className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="whitespace-pre-wrap">{node.notes}</span>
            </p>
          )}
        </div>

        {/* Desktop/laptop: icons directly visible, no dropdown */}
        <div className="hidden shrink-0 items-center gap-0.5 sm:flex">
          <Button
            size="icon"
            variant="ghost"
            onClick={onAddChild}
            aria-label={`Add ${nextMeta.label}`}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Edit">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Delete">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
        {/* Mobile: collapse actions behind "•••" to save space */}
        <div className="shrink-0 sm:hidden">
          <RowActions
            actions={[
              {
                label: `Add ${nextMeta.label}`,
                icon: <Plus className="h-4 w-4" />,
                onClick: onAddChild,
              },
              { label: "Edit", icon: <Pencil className="h-4 w-4" />, onClick: onEdit },
              {
                label: "Delete",
                icon: <Trash2 className="h-4 w-4" />,
                onClick: onDelete,
                destructive: true,
              },
            ]}
          />
        </div>
      </div>

      {hasChildren && collapsedOpen && <div className="mt-2">{children}</div>}
    </div>
  );
}

type FlatLine = { path: WorkNode[]; leaf: WorkNode };

/** Flatten the tree into leaf lines that are NOT done, skipping entire completed subtrees. */
function buildPendingLines(byParent: Map<string | null, WorkNode[]>, today: string): FlatLine[] {
  const out: FlatLine[] = [];
  const walk = (parentId: string | null, trail: WorkNode[]) => {
    const kids = byParent.get(parentId) ?? [];
    for (const n of kids) {
      if (isNodeDone(n, today)) continue; // skip completed subtree
      const nextTrail = [...trail, n];
      const grand = byParent.get(n.id) ?? [];
      const incompleteChildren = grand.filter((c) => !isNodeDone(c, today));
      if (incompleteChildren.length === 0) {
        out.push({ path: nextTrail, leaf: n });
      } else {
        walk(n.id, nextTrail);
      }
    }
  };
  walk(null, []);
  return out;
}

/** Flatten the tree into leaf lines that ARE done. A done node's own children
 * aren't listed separately — the parent being done represents the whole subtree. */
function buildCompletedLines(byParent: Map<string | null, WorkNode[]>, today: string): FlatLine[] {
  const out: FlatLine[] = [];
  const walk = (parentId: string | null, trail: WorkNode[]) => {
    const kids = byParent.get(parentId) ?? [];
    for (const n of kids) {
      const nextTrail = [...trail, n];
      if (isNodeDone(n, today)) {
        out.push({ path: nextTrail, leaf: n });
        continue; // don't descend into an already-completed branch
      }
      walk(n.id, nextTrail);
    }
  };
  walk(null, []);
  return out;
}

function GroupedLines({
  lines,
  checked,
  onToggle,
  onSetPriority,
  onToggleHold,
}: {
  lines: FlatLine[];
  checked: boolean;
  onToggle: (n: WorkNode) => void;
  onSetPriority?: (n: WorkNode, p: Priority) => void;
  onToggleHold?: (n: WorkNode) => void;
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
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">{company.title}</p>
              <span className="text-xs text-muted-foreground">· {items.length}</span>
            </div>
            <div className="space-y-1.5">
              {items.map(({ path, leaf }) => {
                const isHeld = leaf.held;
                const dueLine = formatDueLine(leaf);
                return (
                  <div
                    key={path.map((p) => p.id).join(">")}
                    onClick={() => onToggle(leaf)}
                    className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/30"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => onToggle(leaf)}
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
                            {path.map((n, i) => (
                              <span key={n.id}>
                                {i > 0 && <span className="mx-1.5 text-muted-foreground">›</span>}
                                <span
                                  className={cn(
                                    i === 0 && "font-medium text-primary",
                                    i === path.length - 1 && "font-medium text-foreground",
                                    i > 0 && i < path.length - 1 && "text-muted-foreground",
                                    i === path.length - 1 &&
                                      !checked &&
                                      priorityTextClass(n.priority),
                                    checked &&
                                      i === path.length - 1 &&
                                      "line-through text-muted-foreground",
                                  )}
                                >
                                  {n.title}
                                </span>
                              </span>
                            ))}
                          </span>
                          {dueLine && (
                            <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3 shrink-0" />
                              {dueLine}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    {onSetPriority && !isHeld && (
                      <QuickPriorityMenu
                        value={leaf.priority}
                        onChange={(p) => onSetPriority(leaf, p)}
                      />
                    )}
                    {onToggleHold && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleHold(leaf);
                        }}
                        className="shrink-0 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {isHeld ? (
                          <>
                            <Eye className="h-3.5 w-3.5" /> Show
                          </>
                        ) : (
                          <>
                            <EyeOff className="h-3.5 w-3.5" /> Hold
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PendingList({
  byParent,
  today,
  onToggleDone,
  onSetPriority,
  onToggleHold,
}: {
  byParent: Map<string | null, WorkNode[]>;
  today: string;
  onToggleDone: (n: WorkNode) => void;
  onSetPriority: (n: WorkNode, p: Priority) => void;
  onToggleHold: (n: WorkNode) => void;
}) {
  const lines = useMemo(() => buildPendingLines(byParent, today), [byParent, today]);
  const heldCount = useMemo(() => lines.filter((l) => l.leaf.held).length, [lines]);

  const { data: tasks = [] } = useTasks();
  const updateTask = useUpdateTask();
  // Only show to-dos that are either undated or due today — anything with a
  // past or future due date is left for its own day, so this list doesn't
  // fill up with things that aren't actionable right now.
  const pendingTasks = useMemo(
    () => tasks.filter((t) => !t.done && (!t.due_date || t.due_date === today)),
    [tasks, today],
  );

  const nothingPending = lines.length === 0 && pendingTasks.length === 0;

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        {lines.length} pending work {lines.length === 1 ? "item" : "items"}
        {pendingTasks.length > 0 && ` · ${pendingTasks.length} pending to-do`}
        {heldCount > 0 && ` · ${heldCount} on hold (tap Show to reveal)`}
      </div>

      {nothingPending ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          🎉 Nothing pending. All items completed.
        </div>
      ) : (
        <GroupedLines
          lines={lines}
          checked={false}
          onToggle={onToggleDone}
          onSetPriority={onSetPriority}
          onToggleHold={onToggleHold}
        />
      )}

      {pendingTasks.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-accent" />
            <p className="text-sm font-semibold">To Do List</p>
            <span className="text-xs text-muted-foreground">· {pendingTasks.length} pending</span>
          </div>
          <div className="space-y-1.5">
            {pendingTasks.map((t: Task) => (
              <div
                key={t.id}
                onClick={() => updateTask.mutate({ id: t.id, done: true })}
                className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/30"
              >
                <Checkbox
                  checked={false}
                  onCheckedChange={() => updateTask.mutate({ id: t.id, done: true })}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-0.5 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  {t.held ? (
                    <span
                      className="inline-block h-3.5 w-40 max-w-full rounded bg-muted-foreground/15"
                      aria-label="Hidden"
                    />
                  ) : (
                    <span className="break-words leading-snug">
                      <span className="font-medium text-foreground">{t.title}</span>
                      {(t.due_date || t.due_time) && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {t.due_date ?? ""}
                          {t.due_time ? ` · ${t.due_time}` : ""}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateTask.mutate({ id: t.id, held: !t.held });
                  }}
                  className="shrink-0 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  {t.held ? (
                    <>
                      <Eye className="h-3.5 w-3.5" /> Show
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3.5 w-3.5" /> Hold
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CompletedList({
  byParent,
  today,
  onToggleDone,
  onSetPriority,
}: {
  byParent: Map<string | null, WorkNode[]>;
  today: string;
  onToggleDone: (n: WorkNode) => void;
  onSetPriority: (n: WorkNode, p: Priority) => void;
}) {
  const lines = useMemo(() => buildCompletedLines(byParent, today), [byParent, today]);

  const { data: tasks = [] } = useTasks();
  const updateTask = useUpdateTask();
  const doneTasks = useMemo(() => tasks.filter((t) => t.done), [tasks]);

  const nothingDone = lines.length === 0 && doneTasks.length === 0;
  if (nothingDone) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Nothing completed yet. Finish something in Work &amp; Projects to see it here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        {lines.length} completed work {lines.length === 1 ? "item" : "items"}
        {doneTasks.length > 0 && ` · ${doneTasks.length} completed to-do`}
        {" — untick to move back to Pending Works."}
      </div>

      <GroupedLines
        lines={lines}
        checked={true}
        onToggle={onToggleDone}
        onSetPriority={onSetPriority}
      />

      {doneTasks.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-accent" />
            <p className="text-sm font-semibold">To Do List</p>
            <span className="text-xs text-muted-foreground">· {doneTasks.length} completed</span>
          </div>
          <div className="space-y-1.5">
            {doneTasks.map((t: Task) => (
              <label
                key={t.id}
                className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/30 cursor-pointer"
              >
                <Checkbox
                  checked={true}
                  onCheckedChange={() => updateTask.mutate({ id: t.id, done: false })}
                  className="mt-0.5 shrink-0"
                />
                <span className="min-w-0 flex-1 break-words leading-snug line-through text-muted-foreground">
                  {t.title}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}