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
  Clock,
  AlertTriangle,
  FolderInput,
  PauseCircle,
  PlayCircle,
  HelpCircle,
} from "lucide-react";
import { RowActions } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { WorkNode } from "@/features/work-db";
import { QuickPriorityMenu } from "./PriorityControls";
import {
  iconFor,
  isNodeDone,
  isOverdue,
  formatDueLine,
  priorityTextClass,
  OVERDUE_CLASS,
  type Priority,
} from "./work-helpers";

export function TreeLevel({
  parentId,
  depth,
  byParent,
  collapsed,
  onToggleCollapse,
  onAddChild,
  onEdit,
  onDelete,
  onMove,
  onToggleDone,
  onSetPriority,
  onToggleDeactivate,
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
  onMove: (n: WorkNode) => void;
  onToggleDone: (n: WorkNode) => void;
  onSetPriority: (n: WorkNode, p: Priority) => void;
  onToggleDeactivate: (n: WorkNode) => void;
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
              onMove={() => onMove(n)}
              onToggleDone={() => onToggleDone(n)}
              onSetPriority={(p) => onSetPriority(n, p)}
              onToggleDeactivate={() => onToggleDeactivate(n)}
              effectiveDone={isNodeDone(n, today)}
              today={today}
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
                  onMove={onMove}
                  onToggleDone={onToggleDone}
                  onSetPriority={onSetPriority}
                  onToggleDeactivate={onToggleDeactivate}
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
  onMove,
  onToggleDone,
  onSetPriority,
  onToggleDeactivate,
  effectiveDone,
  today,
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
  onMove: () => void;
  onToggleDone: () => void;
  onSetPriority: (p: Priority) => void;
  onToggleDeactivate: () => void;
  effectiveDone: boolean;
  today: string;
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
  const overdue = isOverdue(node.due_date, effectiveDone, today);

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={cn(
          "group flex items-start gap-1.5 rounded-xl border border-border bg-card p-2.5 transition-colors hover:bg-accent/20 sm:gap-2",
          depth === 0 && "bg-gradient-to-r from-primary/5 to-transparent",
          node.deactivated && "opacity-60",
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
                  : overdue
                    ? cn(OVERDUE_CLASS, "font-semibold")
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
            {node.is_ask && (
              <span className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                <HelpCircle className="h-2.5 w-2.5" />
                Ask{node.ask_person_name ? ` · ${node.ask_person_name}` : ""}
              </span>
            )}
            {node.deactivated && (
              <span className="rounded-full border border-border bg-secondary/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Deactivated
              </span>
            )}
            <QuickPriorityMenu value={node.priority} onChange={(p) => onSetPriority(p)} />
          </div>
          {dueLine && (
            <p
              className={cn(
                "mt-1 flex items-center gap-1 text-xs",
                overdue ? cn(OVERDUE_CLASS, "font-medium") : "text-muted-foreground",
              )}
            >
              {overdue ? (
                <AlertTriangle className="h-3 w-3 shrink-0" />
              ) : (
                <Clock className="h-3 w-3 shrink-0" />
              )}
              {dueLine}
              {overdue && " · Overdue"}
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
          <Button size="icon" variant="ghost" onClick={onMove} aria-label="Move">
            <FolderInput className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onToggleDeactivate}
            aria-label={node.deactivated ? "Activate" : "Deactivate"}
            title={
              node.deactivated
                ? "Activate (bring back into Pending Works)"
                : "Deactivate (pause this and everything under it)"
            }
          >
            {node.deactivated ? (
              <PlayCircle className="h-4 w-4" />
            ) : (
              <PauseCircle className="h-4 w-4" />
            )}
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
              { label: "Move", icon: <FolderInput className="h-4 w-4" />, onClick: onMove },
              {
                label: node.deactivated ? "Activate" : "Deactivate",
                icon: node.deactivated ? (
                  <PlayCircle className="h-4 w-4" />
                ) : (
                  <PauseCircle className="h-4 w-4" />
                ),
                onClick: onToggleDeactivate,
              },
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