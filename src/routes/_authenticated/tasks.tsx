import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckSquare, Plus, Trash2, Pencil, Calendar as CalendarIcon, Clock } from "lucide-react";
import { PageHeader, StatCard } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  type Task,
} from "@/features/tasks-db";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tasks")({
  ssr: false,
  component: TasksPage,
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDue(task: Task): string | null {
  if (!task.due_date && !task.due_time) return null;
  const parts: string[] = [];
  if (task.due_date) {
    const d = new Date(task.due_date + "T00:00:00");
    parts.push(
      `${WEEKDAYS[d.getDay()]}, ${d.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}`,
    );
  }
  if (task.due_time) {
    const [h, m] = task.due_time.split(":");
    const dt = new Date();
    dt.setHours(Number(h), Number(m), 0, 0);
    parts.push(dt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }));
  }
  return parts.join(" • ");
}

function TasksPage() {
  const { data: tasks = [], isLoading } = useTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");

  const { pending, done } = useMemo(() => {
    const p: Task[] = [];
    const d: Task[] = [];
    for (const t of tasks) (t.done ? d : p).push(t);
    return { pending: p, done: d };
  }, [tasks]);

  const resetForm = () => {
    setEditing(null);
    setTitle("");
    setDueDate("");
    setDueTime("");
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (t: Task) => {
    setEditing(t);
    setTitle(t.title);
    setDueDate(t.due_date ?? "");
    setDueTime(t.due_time ? t.due_time.slice(0, 5) : "");
    setOpen(true);
  };

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const payload = {
      title: trimmed,
      due_date: dueDate || null,
      due_time: dueTime ? `${dueTime}:00` : null,
    };
    if (editing) {
      await updateTask.mutateAsync({ id: editing.id, ...payload });
    } else {
      await createTask.mutateAsync(payload);
    }
    setOpen(false);
    resetForm();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        subtitle="One-off things to get done. Add a title, optional date and time."
        actions={
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> New task
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total" value={tasks.length} icon={CheckSquare} />
        <StatCard label="Pending" value={pending.length} icon={Clock} />
        <StatCard label="Completed" value={done.length} icon={CheckSquare} />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Pending ({pending.length})
        </h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : pending.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card/40 p-6 text-sm text-muted-foreground">
            No pending tasks. Add one to get started.
          </p>
        ) : (
          <ul className="space-y-2">
            {pending.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onToggle={(done) => updateTask.mutate({ id: t.id, done })}
                onEdit={() => openEdit(t)}
                onDelete={() => deleteTask.mutate(t.id)}
              />
            ))}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Completed ({done.length})
          </h2>
          <ul className="space-y-2">
            {done.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onToggle={(done) => updateTask.mutate({ id: t.id, done })}
                onEdit={() => openEdit(t)}
                onDelete={() => deleteTask.mutate(t.id)}
              />
            ))}
          </ul>
        </section>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit task" : "New task"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">
                Task <span className="text-destructive">*</span>
              </Label>
              <Input
                id="task-title"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Book ticket at 4:30 PM on 17 Jul 2026"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && title.trim()) submit();
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="task-date">Date (optional)</Label>
                <Input
                  id="task-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-time">Time (optional)</Label>
                <Input
                  id="task-time"
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!title.trim()}>
              {editing ? "Save" : "Add task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Task;
  onToggle: (done: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const due = formatDue(task);
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3 transition-colors",
        task.done && "opacity-70",
      )}
    >
      <Checkbox
        checked={task.done}
        onCheckedChange={(v) => onToggle(!!v)}
        aria-label="Toggle done"
      />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", task.done && "line-through text-muted-foreground")}>
          {task.title}
        </p>
        {due && (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarIcon className="h-3 w-3" /> {due}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Edit">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Delete">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </motion.li>
  );
}
