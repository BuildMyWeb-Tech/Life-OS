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
import { useState } from "react";
import { motion } from "framer-motion";
import { GripVertical, Plus, Pencil, Trash2, Copy, Clock, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocal, todayKey } from "@/lib/storage";
import { DEFAULT_ROUTINE, type RoutineItem, type RoutineState } from "@/features/routine-types";
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

export const Route = createFileRoute("/_authenticated/routine")({
  ssr: false,
  component: RoutinePage,
});

const newId = () => Math.random().toString(36).slice(2, 10);

function RoutinePage() {
  const [state, setState] = useLocal<RoutineState>("lifeos:routine", DEFAULT_ROUTINE);
  const [adding, setAdding] = useState("");
  const [editing, setEditing] = useState<RoutineItem | null>(null);
  const today = todayKey();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setState((s) => {
      const oldIdx = s.items.findIndex((i) => i.id === active.id);
      const newIdx = s.items.findIndex((i) => i.id === over.id);
      return { ...s, items: arrayMove(s.items, oldIdx, newIdx) };
    });
  };

  const toggle = (id: string) =>
    setState((s) => ({
      ...s,
      completion: {
        ...s.completion,
        [today]: { ...(s.completion[today] ?? {}), [id]: !s.completion[today]?.[id] },
      },
    }));

  const add = () => {
    if (!adding.trim()) return;
    setState((s) => ({ ...s, items: [...s.items, { id: newId(), title: adding.trim() }] }));
    setAdding("");
    toast.success("Activity added");
  };

  const remove = (id: string) => {
    setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) }));
    toast("Activity deleted");
  };

  const duplicate = (it: RoutineItem) => {
    setState((s) => {
      const idx = s.items.findIndex((i) => i.id === it.id);
      const copy = { ...it, id: newId(), title: it.title + " (copy)" };
      const items = [...s.items];
      items.splice(idx + 1, 0, copy);
      return { ...s, items };
    });
  };

  const saveEdit = (item: RoutineItem) => {
    setState((s) => ({ ...s, items: s.items.map((i) => (i.id === item.id ? item : i)) }));
    setEditing(null);
    toast.success("Updated");
  };

  const done = state.items.filter((i) => state.completion[today]?.[i.id]).length;
  const pct = state.items.length ? Math.round((done / state.items.length) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader
        title="Daily Routine"
        subtitle="Drag to reorder. Check as you go."
      />

      <div className="glass mb-6 rounded-2xl p-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">Today's progress</span>
          <span className="text-muted-foreground">{done} / {state.items.length} · {pct}%</span>
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
        <SortableContext items={state.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {state.items.map((item) => (
              <SortableRow
                key={item.id}
                item={item}
                checked={!!state.completion[today]?.[item.id]}
                onToggle={() => toggle(item.id)}
                onEdit={() => setEditing(item)}
                onDelete={() => remove(item.id)}
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
      <Checkbox checked={checked} onCheckedChange={onToggle} className="h-5 w-5" />
      <div className="min-w-0 flex-1">
        <p className={"truncate text-sm font-medium " + (checked ? "text-muted-foreground line-through" : "")}>
          {item.title}
        </p>
        <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {item.time && (<span className="flex items-center gap-1"><Clock className="h-3 w-3" />{item.time}</span>)}
          {item.notes && (<span className="flex items-center gap-1"><StickyNote className="h-3 w-3" />{item.notes}</span>)}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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
              <Input type="time" value={draft.time ?? ""} onChange={(e) => setDraft({ ...draft, time: e.target.value })} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={3} />
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
