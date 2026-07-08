import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  Check,
  Eye,
  ArrowLeft,
} from "lucide-react";

import { toast } from "sonner";
import { PageHeader } from "@/components/ui-bits";
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

function WorkPage() {
  const { data: nodes = [] } = useWorkNodes();
  const create = useCreateWorkNode();
  const update = useUpdateWorkNode();
  const del = useDeleteWorkNode();
  const reorder = useReorderWorkNodes();

  const [newCompany, setNewCompany] = useState("");
  const [editing, setEditing] = useState<WorkNode | null>(null);
  const [addingUnder, setAddingUnder] = useState<{ parent: WorkNode | null; depth: number } | null>(null);
  const [addTitle, setAddTitle] = useState("");
  const [addKind, setAddKind] = useState<"recurring" | "one_time">("recurring");
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

  const PREVIEW_KEY = "lifeos:work:preview";
  const [preview, setPreview] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(PREVIEW_KEY) === "1";
    } catch {
      return false;
    }
  });
  const togglePreview = (v: boolean) => {
    setPreview(v);
    try {
      localStorage.setItem(PREVIEW_KEY, v ? "1" : "0");
    } catch {}
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

  const submitAdd = () => {
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
        due_date: canBeOneTime && addDueDate ? addDueDate : null,
        due_time: canBeOneTime && addDueTime ? `${addDueTime}:00` : null,
      },
      {
        onSuccess: () => {
          setAddTitle("");
          setAddKind("recurring");
          setAddDueDate("");
          setAddDueTime("");
          setAddingUnder(null);
          toast.success("Added");
        },
      },
    );
  };

  const toggleDone = (n: WorkNode) => {
    const isDoneToday = n.done && n.done_on === today;
    // One-time item: when marking done, remove it entirely (and its children).
    if (!isDoneToday && n.task_kind === "one_time") {
      del.mutate(n.id, {
        onSuccess: () => toast.success("Completed & removed"),
      });
      return;
    }
    update.mutate({
      id: n.id,
      done: !isDoneToday,
      done_on: isDoneToday ? null : today,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          title={preview ? "Preview — Pending Work" : "Work & Projects"}
          subtitle={
            preview
              ? "Only incomplete items. Tick to mark done. Parent completed hides its children."
              : "Companies → categories → works → tasks. Drag to reorder within a group."
          }
        />
        {preview ? (
          <Button variant="outline" className="gap-2" onClick={() => togglePreview(false)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        ) : (
          <Button variant="outline" className="gap-2" onClick={() => togglePreview(true)}>
            <Eye className="h-4 w-4" /> Preview
          </Button>
        )}
      </div>

      {preview ? (
        <PreviewList byParent={byParent} today={today} onToggleDone={toggleDone} />
      ) : (
        <>
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
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitAdd()}
              placeholder="e.g. Project Development"
            />
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
                  <Input type="date" value={addDueDate} onChange={(e) => setAddDueDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Time (optional)</Label>
                  <Input type="time" value={addDueTime} onChange={(e) => setAddDueTime(e.target.value)} />
                </div>
              </div>
              {addDueDate && addDueTime && (
                <p className="text-xs text-primary">⏰ You'll be reminded at that time.</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddingUnder(null)}>Cancel</Button>
            <Button onClick={submitAdd}>Add</Button>
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
                update.mutate(
                  { id: editing.id, ...patch },
                  { onSuccess: () => setEditing(null) },
                );
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
  onSubmit: (patch: { title: string; notes: string | null; task_kind: "recurring" | "one_time" }) => void;
}) {
  const [title, setTitle] = useState(node.title);
  const [notes, setNotes] = useState(node.notes ?? "");
  const [kind, setKind] = useState<"recurring" | "one_time">(node.task_kind ?? "recurring");
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
      <DialogFooter>
        <Button onClick={() => onSubmit({ title: title.trim() || node.title, notes: notes.trim() || null, task_kind: kind })}>
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
    onReorderSiblings(parentId, next.map((i) => i.id));
  };

  if (items.length === 0) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className={cn("space-y-2", depth > 0 && "ml-4 border-l border-border/60 pl-4")}>
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
              effectiveDone={n.done && n.done_on === today}
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

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={cn(
          "group flex items-start gap-2 rounded-xl border border-border bg-card p-2.5 transition-colors hover:bg-accent/20",
          depth === 0 && "bg-gradient-to-r from-primary/5 to-transparent",
        )}
      >
        <button
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Drag"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <button
          onClick={onToggleCollapse}
          className={cn(
            "mt-0.5 rounded p-0.5 text-muted-foreground hover:bg-accent/40",
            !hasChildren && "invisible",
          )}
          aria-label="Toggle"
        >
          <ChevronRight
            className={cn("h-4 w-4 transition-transform", collapsedOpen && "rotate-90")}
          />
        </button>

        <Checkbox checked={effectiveDone} onCheckedChange={onToggleDone} className="mt-1" />

        <Icon className={cn("mt-1 h-4 w-4 shrink-0", meta.color)} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p
              className={cn(
                "break-words text-sm font-medium leading-snug",
                depth === 0 && "text-base font-semibold",
                effectiveDone && "text-muted-foreground line-through",
              )}
            >
              {node.title}
            </p>
            <span className="hidden text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">
              {meta.label}
            </span>
            {node.task_kind === "one_time" && (
              <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                One-time
              </span>
            )}
          </div>
          {node.notes && (
            <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
              <StickyNote className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="whitespace-pre-wrap">{node.notes}</span>
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1 opacity-70 group-hover:opacity-100">
          <Button size="sm" variant="ghost" onClick={onAddChild} title={`Add ${nextMeta.label}`}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit} title="Edit">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            title="Delete"
            className="text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {hasChildren && collapsedOpen && <div className="mt-2">{children}</div>}
    </div>
  );
}

// Keep unused import happy in some setups
void Check;

type PreviewLine = { path: WorkNode[]; leaf: WorkNode };

function buildPreviewLines(
  byParent: Map<string | null, WorkNode[]>,
  today: string,
): PreviewLine[] {
  const out: PreviewLine[] = [];
  const walk = (parentId: string | null, trail: WorkNode[]) => {
    const kids = byParent.get(parentId) ?? [];
    for (const n of kids) {
      const done = n.done && n.done_on === today;
      if (done) continue; // skip completed subtree
      const nextTrail = [...trail, n];
      const grand = byParent.get(n.id) ?? [];
      const incompleteChildren = grand.filter((c) => !(c.done && c.done_on === today));
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

function PreviewList({
  byParent,
  today,
  onToggleDone,
}: {
  byParent: Map<string | null, WorkNode[]>;
  today: string;
  onToggleDone: (n: WorkNode) => void;
}) {
  const lines = useMemo(() => buildPreviewLines(byParent, today), [byParent, today]);

  const { data: tasks = [] } = useTasks();
  const updateTask = useUpdateTask();
  const pendingTasks = useMemo(() => tasks.filter((t) => !t.done), [tasks]);

  const nothingPending = lines.length === 0 && pendingTasks.length === 0;
  if (nothingPending) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        🎉 Nothing pending. All items completed.
      </div>
    );
  }

  // Group by company (root)
  const groups = new Map<string, PreviewLine[]>();
  for (const l of lines) {
    const key = l.path[0].id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(l);
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        {lines.length} pending work {lines.length === 1 ? "item" : "items"}
        {pendingTasks.length > 0 && ` · ${pendingTasks.length} pending to-do`}
      </div>
      {[...groups.entries()].map(([companyId, items]) => {
        const company = items[0].path[0];
        return (
          <div key={companyId} className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">{company.title}</p>
              <span className="text-xs text-muted-foreground">
                · {items.length} pending
              </span>
            </div>
            <div className="space-y-1.5">
              {items.map(({ path, leaf }) => (
                <label
                  key={path.map((p) => p.id).join(">")}
                  className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/30 cursor-pointer"
                >
                  <Checkbox
                    checked={false}
                    onCheckedChange={() => onToggleDone(leaf)}
                    className="mt-0.5"
                  />
                  <span className="flex-1 leading-snug">
                    {path.map((n, i) => (
                      <span key={n.id}>
                        {i > 0 && (
                          <span className="mx-1.5 text-muted-foreground">›</span>
                        )}
                        <span
                          className={cn(
                            i === 0 && "font-medium text-primary",
                            i === path.length - 1 && "font-medium text-foreground",
                            i > 0 && i < path.length - 1 && "text-muted-foreground",
                          )}
                        >
                          {n.title}
                        </span>
                      </span>
                    ))}
                  </span>
                </label>
              ))}
            </div>
          </div>
        );
      })}

      {pendingTasks.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-accent" />
            <p className="text-sm font-semibold">To Do List</p>
            <span className="text-xs text-muted-foreground">
              · {pendingTasks.length} pending
            </span>
          </div>
          <div className="space-y-1.5">
            {pendingTasks.map((t: Task) => (
              <label
                key={t.id}
                className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/30 cursor-pointer"
              >
                <Checkbox
                  checked={false}
                  onCheckedChange={() => updateTask.mutate({ id: t.id, done: true })}
                  className="mt-0.5"
                />
                <span className="flex-1 leading-snug">
                  <span className="font-medium text-foreground">{t.title}</span>
                  {(t.due_date || t.due_time) && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {t.due_date ?? ""}{t.due_time ? ` · ${t.due_time}` : ""}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

