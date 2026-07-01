import { createFileRoute } from "@tanstack/react-router";
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
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { GripVertical, Plus, Pencil, Trash2, Copy, Clock, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { todayKey, prettyDate } from "@/lib/storage";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useRoutineItems,
  useRoutineLogs,
  useCreateRoutineItem,
  useUpdateRoutineItem,
  useDeleteRoutineItem,
  useReorderRoutineItems,
  useToggleRoutine,
  useEnsureDefaultRoutine,
  routineLogIndex,
  isRoutineDone,
  type RoutineItem,
} from "@/features/routine-db";
import { useHabits, useToggleHabit, useHabitLogs, logIndex, isDone } from "@/features/habits-db";
import { findHabitByTitle } from "@/lib/cross-sync";

export const Route = createFileRoute("/_authenticated/routine")({
  ssr: false,
  component: RoutinePage,
});

function RoutinePage() {
  const today = todayKey();
  const { data: items = [], isFetched } = useRoutineItems();
  const { data: logs = [] } = useRoutineLogs(today, today);
  const create = useCreateRoutineItem();
  const update = useUpdateRoutineItem();
  const del = useDeleteRoutineItem();
  const reorder = useReorderRoutineItems();
  const toggleRoutine = useToggleRoutine();

  useEnsureDefaultRoutine(items, isFetched);

  const { data: habits = [] } = useHabits();
  const { data: habitLogs = [] } = useHabitLogs(today, today);
  const habitToggle = useToggleHabit();
  const habitSet = useMemo(() => logIndex(habitLogs), [habitLogs]);
  const doneSet = useMemo(() => routineLogIndex(logs), [logs]);

  const [adding, setAdding] = useState("");
  const [editing, setEditing] = useState<RoutineItem | null>(null);

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
    const next = arrayMove(items, oldIdx, newIdx).map((it, i) => ({ id: it.id, sort_order: i }));
    reorder.mutate(next);
  };

  const toggle = (item: RoutineItem) => {
    const done = isRoutineDone(doneSet, item.id, today);
    toggleRoutine.mutate({ item_id: item.id, log_date: today, done: !done });
    // mirror to matching habit
    const matched = findHabitByTitle(habits, item.title);
    if (matched) {
      const currentlyDone = isDone(habitSet, matched.id, today);
      if (currentlyDone === done) {
        habitToggle.mutate({ habit_id: matched.id, log_date: today, done: !done });
      }
    }
  };

  const add = () => {
    if (!adding.trim()) return;
    create.mutate(
      { title: adding.trim(), sort_order: items.length },
      { onSuccess: () => toast.success("Activity added") },
    );
    setAdding("");
  };

  const duplicate = (it: RoutineItem) => {
    create.mutate({
      title: it.title + " (copy)",
      time: it.time,
      notes: it.notes,
      sort_order: items.length,
    });
  };

  const saveEdit = (item: RoutineItem) => {
    update.mutate(
      { id: item.id, title: item.title, time: item.time, notes: item.notes },
      { onSuccess: () => toast.success("Updated") },
    );
    setEditing(null);
  };

  const done = items.filter((i) => isRoutineDone(doneSet, i.id, today)).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader title="Daily Routine" subtitle={`${prettyDate(today)} · resets at 4:30 AM`} />

      <div className="glass mb-6 rounded-2xl p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium">Today's progress</span>
          <span className="text-muted-foreground">{done} / {items.length} · {pct}%</span>
        </div>
        <Progress value={pct} />
      </div>

      <div className="glass mb-4 flex gap-2 rounded-2xl p-3">
        <Input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add a new activity (e.g. Read 20 pages)"
          className="bg-transparent"
        />
        <Button onClick={add} className="gap-2"><Plus className="h-4 w-4" /> Add</Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {items.map((item) => (
              <SortableRow
                key={item.id}
                item={item}
                checked={isRoutineDone(doneSet, item.id, today)}
                onToggle={() => toggle(item)}
                onEdit={() => setEditing(item)}
                onDelete={() => del.mutate(item.id)}
                onDuplicate={() => duplicate(item)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <EditDialog item={editing} onClose={() => setEditing(null)} onSave={saveEdit} />
    </motion.div>
  );
}

function SortableRow({
  item,
  checked,
  onToggle,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  item: RoutineItem;
  checked: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="glass group flex items-center gap-3 rounded-xl px-3 py-3"
    >
      <button {...attributes} {...listeners} className="cursor-grab p-1 text-muted-foreground hover:text-foreground" aria-label="drag">
        <GripVertical className="h-4 w-4" />
      </button>
      <Checkbox checked={checked} onCheckedChange={onToggle} className="h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className={"break-words text-sm font-medium " + (checked ? "text-muted-foreground line-through" : "")}>
          {item.title}
        </p>
        <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {item.time && (<span className="flex items-center gap-1"><Clock className="h-3 w-3" />{item.time}</span>)}
          {item.notes && (<span className="flex items-center gap-1"><StickyNote className="h-3 w-3" />{item.notes}</span>)}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
        <Button size="icon" variant="ghost" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" onClick={onDuplicate}><Copy className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
      </div>
    </li>
  );
}

function EditDialog({
  item,
  onClose,
  onSave,
}: {
  item: RoutineItem | null;
  onClose: () => void;
  onSave: (i: RoutineItem) => void;
}) {
  const [draft, setDraft] = useState<RoutineItem | null>(item);
  if (item && draft?.id !== item.id) setDraft(item);
  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass">
        <DialogHeader><DialogTitle>Edit Activity</DialogTitle></DialogHeader>
        {draft && (
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
            <div>
              <Label>Time (optional)</Label>
              <Input type="time" value={draft.time ?? ""} onChange={(e) => setDraft({ ...draft, time: e.target.value || null })} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value || null })} rows={3} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => draft && onSave(draft)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
