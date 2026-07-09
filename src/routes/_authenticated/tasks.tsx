import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckSquare,
  Plus,
  Trash2,
  Pencil,
  Calendar as CalendarIcon,
  Clock,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ListChecks,
  Search,
  X,
} from "lucide-react";
import { PageHeader, StatCard, RowActions } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { todayKey, prettyDate } from "@/lib/storage";
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
  useSubtasks,
  subtasksByTask,
  useCreateSubtask,
  useToggleSubtask,
  useDeleteSubtask,
  type Task,
  type Subtask,
} from "@/features/tasks-db";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tasks")({
  ssr: false,
  component: TasksPage,
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type TaskFilter = "all" | "completed" | "pending";
const FILTER_KEY = "lifeos:tasks:filter";

function loadTaskFilter(): TaskFilter {
  if (typeof window === "undefined") return "all";
  try {
    const v = localStorage.getItem(FILTER_KEY);
    if (v === "all" || v === "completed" || v === "pending") return v;
  } catch {
    /* ignore */
  }
  return "all";
}

function saveTaskFilter(v: TaskFilter) {
  try {
    localStorage.setItem(FILTER_KEY, v);
  } catch {
    /* ignore */
  }
}

function shiftDate(key: string, delta: number) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

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
  const { data: subtasks = [] } = useSubtasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const subtaskMap = useMemo(() => subtasksByTask(subtasks), [subtasks]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [filter, setFilter] = useState<TaskFilter>(loadTaskFilter);
  const [dateFilter, setDateFilter] = useState<string | null>(null); // null = All Dates
  const [search, setSearch] = useState("");

  const changeFilter = (f: TaskFilter) => {
    setFilter(f);
    saveTaskFilter(f);
  };

  // Date + search apply first (tab counts are computed against this subset,
  // same pattern as the Daily Routine tabs).
  const dateAndSearchFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (dateFilter && t.due_date !== dateFilter) return false;
      if (q && !t.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, dateFilter, search]);

  const pendingCount = dateAndSearchFiltered.filter((t) => !t.done).length;
  const doneCount = dateAndSearchFiltered.filter((t) => t.done).length;

  const visible = useMemo(() => {
    return dateAndSearchFiltered.filter((t) => {
      if (filter === "completed") return t.done;
      if (filter === "pending") return !t.done;
      return true;
    });
  }, [dateAndSearchFiltered, filter]);

  const resetForm = () => {
    setEditing(null);
    setTitle("");
    setDueDate(dateFilter ?? "");
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

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="To Do List"
        subtitle="One-off things to get done. Add a title, optional date and time."
        action={
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> New task
          </Button>
        }
      />

     <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard
          compact
          label="Total"
          value={tasks.length}
          icon={<CheckSquare className="h-4 w-4" />}
        />
        <StatCard
          compact
          label="Pending"
          value={tasks.filter((t) => !t.done).length}
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          compact
          label="Completed"
          value={tasks.filter((t) => t.done).length}
          icon={<CheckSquare className="h-4 w-4" />}
        />
      </div>

      {/* Date navigator — mirrors the Daily Routine page */}
      <div className="glass flex items-center justify-between gap-2 rounded-2xl p-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDateFilter((d) => shiftDate(d ?? todayKey(), -1))}
          aria-label="Previous day"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-col items-center text-center">
          <span className="text-sm font-semibold">
            {dateFilter ? prettyDate(dateFilter) : "All Dates"}
          </span>
          {dateFilter ? (
            <button
              onClick={() => setDateFilter(null)}
              className="text-xs text-primary hover:underline"
            >
              Clear date filter
            </button>
          ) : (
            <button
              onClick={() => setDateFilter(todayKey())}
              className="text-xs text-primary hover:underline"
            >
              Jump to today
            </button>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDateFilter((d) => shiftDate(d ?? todayKey(), 1))}
          aria-label="Next day"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks…"
          className="pl-9 pr-9"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Tabs value={filter} onValueChange={(v) => changeFilter(v as TaskFilter)}>
        <TabsList className="grid w-full grid-cols-3 sm:w-auto">
          <TabsTrigger value="all">All ({dateAndSearchFiltered.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({doneCount})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
        </TabsList>
      </Tabs>

      <section className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card/40 p-6 text-sm text-muted-foreground">
            No {filter === "all" ? "tasks" : filter} match
            {dateFilter ? ` ${prettyDate(dateFilter)}` : ""}
            {search ? ` "${search}"` : ""}.
          </p>
        ) : (
          <ul className="space-y-2">
            {visible.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                subtasks={subtaskMap.get(t.id) ?? []}
                expanded={expanded.has(t.id)}
                onToggleExpand={() => toggleExpanded(t.id)}
                onToggle={(done) => updateTask.mutate({ id: t.id, done })}
                onEdit={() => openEdit(t)}
                onDelete={() => deleteTask.mutate(t.id)}
              />
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) resetForm();
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
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

          {editing && (
            <SubtaskEditor taskId={editing.id} subtasks={subtaskMap.get(editing.id) ?? []} />
          )}
          {!editing && (
            <p className="text-xs text-muted-foreground">
              Save the task first, then reopen it to add sub-tasks.
            </p>
          )}

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

function SubtaskEditor({ taskId, subtasks }: { taskId: string; subtasks: Subtask[] }) {
  const createSubtask = useCreateSubtask();
  const toggleSubtask = useToggleSubtask();
  const deleteSubtask = useDeleteSubtask();
  const [text, setText] = useState("");

  const add = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    createSubtask.mutate({ task_id: taskId, title: trimmed, sort_order: subtasks.length });
    setText("");
  };

  const doneCount = subtasks.filter((s) => s.done).length;

  return (
    <div className="space-y-2 border-t border-border pt-4">
      <Label className="flex items-center gap-2">
        <ListChecks className="h-4 w-4" /> Sub-tasks{" "}
        {subtasks.length > 0 && (
          <span className="text-xs font-normal text-muted-foreground">
            ({doneCount}/{subtasks.length} done)
          </span>
        )}
      </Label>
      {subtasks.length > 0 && (
        <ul className="space-y-1">
          {subtasks.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-2 rounded-lg bg-secondary/40 px-2 py-1.5"
            >
              <Checkbox
                checked={s.done}
                onCheckedChange={(v) => toggleSubtask.mutate({ id: s.id, done: !!v })}
              />
              <span
                className={cn("flex-1 text-sm", s.done && "text-muted-foreground line-through")}
              >
                {s.title}
              </span>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => deleteSubtask.mutate(s.id)}
                aria-label="Delete sub-task"
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder="Add a sub-task"
          className="bg-transparent"
        />
        <Button type="button" size="icon" onClick={add} aria-label="Add sub-task">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function TaskRow({
  task,
  subtasks,
  expanded,
  onToggleExpand,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Task;
  subtasks: Subtask[];
  expanded: boolean;
  onToggleExpand: () => void;
  onToggle: (done: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const toggleSubtask = useToggleSubtask();
  const due = formatDue(task);
  const hasSubtasks = subtasks.length > 0;
  const subDone = subtasks.filter((s) => s.done).length;
  const subPct = hasSubtasks ? Math.round((subDone / subtasks.length) * 100) : 0;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border border-border bg-card/60 transition-colors",
        task.done && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3 p-3">
        <Checkbox
          checked={task.done}
          onCheckedChange={(v) => onToggle(!!v)}
          aria-label="Toggle done"
          className="mt-0.5"
        />
        <button
          type="button"
          onClick={hasSubtasks ? onToggleExpand : undefined}
          className={cn("min-w-0 flex-1 text-left", !hasSubtasks && "cursor-default")}
        >
          <p
            className={cn(
              "break-words text-sm font-medium",
              task.done && "line-through text-muted-foreground",
            )}
          >
            {task.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {due && (
              <span className="flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" /> {due}
              </span>
            )}
            {hasSubtasks && (
              <span className="flex items-center gap-1">
                {expanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                <ListChecks className="h-3 w-3" /> {subDone}/{subtasks.length} sub-tasks
              </span>
            )}
          </div>
          {hasSubtasks && <Progress value={subPct} className="mt-2 h-1" />}
        </button>
        <RowActions
          actions={[
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

      {hasSubtasks && expanded && (
        <ul className="space-y-1 border-t border-border/60 px-3 pb-3 pt-2">
          {subtasks.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-2 rounded-lg bg-secondary/30 px-2 py-1.5"
            >
              <Checkbox
                checked={s.done}
                onCheckedChange={(v) => toggleSubtask.mutate({ id: s.id, done: !!v })}
                className="h-4 w-4"
              />
              <span
                className={cn("flex-1 text-xs", s.done && "text-muted-foreground line-through")}
              >
                {s.title}
              </span>
            </li>
          ))}
        </ul>
      )}
    </motion.li>
  );
}