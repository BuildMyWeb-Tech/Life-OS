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
import { GripVertical, Plus, Pencil, Trash2, Copy, Clock, StickyNote, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

function shiftDate(key: string, delta: number) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function RoutinePage() {
  const today = todayKey();
  const [selectedDate, setSelectedDate] = useState(today);
  const [filter, setFilter] = useState<"all" | "completed" | "pending">("all");

  const { data: items = [], isFetched } = useRoutineItems();
  const { data: logs = [] } = useRoutineLogs(selectedDate, selectedDate);
  const create = useCreateRoutineItem();
  const update = useUpdateRoutineItem();
  const del = useDeleteRoutineItem();
  const reorder = useReorderRoutineItems();
  const toggleRoutine = useToggleRoutine();

  useEnsureDefaultRoutine(items, isFetched);

  const { data: habits = [] } = useHabits();
  const { data: habitLogs = [] } = useHabitLogs(selectedDate, selectedDate);
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
    const done = isRoutineDone(doneSet, item.id, selectedDate);
    toggleRoutine.mutate({ item_id: item.id, log_date: selectedDate, done: !done });
    // mirror to matching habit
    const matched = findHabitByTitle(habits, item.title);
    if (matched) {
      const currentlyDone = isDone(habitSet, matched.id, selectedDate);
      if (currentlyDone === done) {
        habitToggle.mutate({ habit_id: matched.id, log_date: selectedDate, done: !done });
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

  const done = items.filter((i) => isRoutineDone(doneSet, i.id, selectedDate)).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const isToday = selectedDate === today;
  const isFuture = selectedDate > today;

  const visibleItems = items.filter((i) => {
    if (filter === "all") return true;
    const isChecked = isRoutineDone(doneSet, i.id, selectedDate);
    return filter === "completed" ? isChecked : !isChecked;
  });

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader title="Daily Routine" subtitle="Resets at 4:30 AM · use arrows to review past days" />

      <div className="glass mb-4 flex items-center justify-between gap-2 rounded-2xl p-3">
        <Button variant="ghost" size="icon" onClick={() => setSelectedDate((d) => shiftDate(d, -1))} aria-label="Previous day">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-col items-center text-center">
          <span className="text-sm font-semibold">{prettyDate(selectedDate)}</span>
          {!isToday && (
            <button
              onClick={() => setSelectedDate(today)}
              className="text-xs text-primary hover:underline"
            >
              Jump to today
            </button>
          )}
          {isToday && <span className="text-[10px] uppercase tracking-wider text-primary">Today</span>}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSelectedDate((d) => shiftDate(d, 1))}
          disabled={isToday}
          aria-label="Next day"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="glass mb-6 rounded-2xl p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium">Progress {isToday ? "today" : "on this day"}</span>
          <span className="text-muted-foreground">{done} / {items.length} · {pct}%</span>
        </div>
        <Progress value={pct} />
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mb-4">
        <TabsList className="grid w-full grid-cols-3 sm:w-auto">
          <TabsTrigger value="all">All ({items.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({done})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({items.length - done})</TabsTrigger>
        </TabsList>
      </Tabs>

      {isToday && (
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
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {visibleItems.map((item) => (
              <SortableRow
                key={item.id}
                item={item}
                checked={isRoutineDone(doneSet, item.id, selectedDate)}
                disabled={isFuture}
                onToggle={() => toggle(item)}
                onEdit={() => setEditing(item)}
                onDelete={() => del.mutate(item.id)}
                onDuplicate={() => duplicate(item)}
              />
            ))}
            {visibleItems.length === 0 && (
              <li className="glass rounded-xl p-6 text-center text-sm text-muted-foreground">
                No {filter === "all" ? "activities" : filter} for this day.
              </li>
            )}
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
  disabled,
  onToggle,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  item: RoutineItem;
  checked: boolean;
  disabled?: boolean;
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
      <Checkbox checked={checked} disabled={disabled} onCheckedChange={onToggle} className="h-5 w-5 shrink-0" />
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
