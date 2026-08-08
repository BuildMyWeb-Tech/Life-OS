import { useMemo } from "react";
import { Building2, Clock, AlertTriangle, Eye, EyeOff, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useTasks, useUpdateTask, type Task } from "@/features/tasks-db";
import type { WorkNode } from "@/features/work-db";
import { QuickPriorityMenu } from "./PriorityControls";
import {
  buildCompletedLines,
  formatDueLine,
  isEffectivelyHeld,
  isOverdue,
  priorityTextClass,
  OVERDUE_CLASS,
  type FlatLine,
  type Priority,
} from "./work-helpers";

export function GroupedLines({
  lines,
  checked,
  today,
  sectionLabel,
  onToggle,
  onSetPriority,
  onToggleHold,
}: {
  lines: FlatLine[];
  checked: boolean;
  today: string;
  sectionLabel?: "shown" | "hidden";
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
              <span className="text-xs text-muted-foreground">
                · {items.length} {sectionLabel ?? ""}
              </span>
            </div>
            <div className="space-y-1.5">
              {items.map(({ path, leaf }) => {
                const isHeld = isEffectivelyHeld(leaf.held, leaf.held_until);
                const dueLine = formatDueLine(leaf);
                const overdue = !checked && isOverdue(leaf.due_date, false, today);
                return (
                  <div
                    key={path.map((p) => p.id).join(">")}
                    onClick={() => onToggle(leaf)}
                    className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-xs sm:text-sm hover:bg-accent/30"
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
                                      (overdue ? OVERDUE_CLASS : priorityTextClass(n.priority)),
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
                            <span
                              className={cn(
                                "mt-0.5 flex items-center gap-1 text-xs",
                                overdue
                                  ? cn(OVERDUE_CLASS, "font-medium")
                                  : "text-muted-foreground",
                              )}
                            >
                              {overdue ? (
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                              ) : (
                                <Clock className="h-3 w-3 shrink-0" />
                              )}
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
                          <Eye className="h-3.5 w-3.5" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5" />
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

export function CompletedList({
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
        today={today}
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