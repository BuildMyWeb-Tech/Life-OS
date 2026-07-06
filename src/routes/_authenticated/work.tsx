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
    create.mutate(
      {
        parent_id: parent?.id ?? null,
        title: t,
        node_type: type,
        sort_order: siblings.length,
      },
      {
        onSuccess: () => {
          setAddTitle("");
          setAddingUnder(null);
          toast.success("Added");
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work & Projects"
        subtitle="Companies → categories → works → tasks. Drag to reorder within a group."
      />

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
          onToggleDone={(n) => {
            const isDoneToday = n.done && n.done_on === today;
            update.mutate({
              id: n.id,
              done: !isDoneToday,
              done_on: isDoneToday ? null : today,
            });
          }}
          today={today}
          onReorderSiblings={(parent_id, ids) => {
            const rows = ids.map((id, i) => ({ id, sort_order: i, parent_id }));
            reorder.mutate(rows);
          }}
        />
      </div>

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
  onSubmit: (patch: { title: string; notes: string | null }) => void;
}) {
  const [title, setTitle] = useState(node.title);
  const [notes, setNotes] = useState(node.notes ?? "");
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
      <DialogFooter>
        <Button onClick={() => onSubmit({ title: title.trim() || node.title, notes: notes.trim() || null })}>
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
