import { Building2, FolderKanban, ListChecks, CheckSquare } from "lucide-react";
import type { WorkNode } from "@/features/work-db";

export const TYPE_META = [
  { key: "company", label: "Company", icon: Building2, color: "text-primary" },
  { key: "category", label: "Category", icon: FolderKanban, color: "text-accent" },
  { key: "work", label: "Work", icon: ListChecks, color: "text-foreground" },
  { key: "task", label: "Task", icon: CheckSquare, color: "text-muted-foreground" },
] as const;

export function iconFor(depth: number) {
  return TYPE_META[Math.min(depth, TYPE_META.length - 1)];
}

export const PRIORITY_META = {
  low: { label: "Low", textClass: "text-sky-600 dark:text-sky-400", dotClass: "bg-sky-500" },
  medium: {
    label: "Medium",
    textClass: "text-amber-700/70 dark:text-amber-300/60",
    dotClass: "bg-amber-500/50",
  },
  high: { label: "High", textClass: "text-red-600 dark:text-red-400", dotClass: "bg-red-500" },
} as const;

export type Priority = "low" | "medium" | "high" | null;

/** No priority set → default/foreground text color ("white"). Any of the
 * three explicit levels gets its own color, including Medium. */
export function priorityTextClass(priority: Priority) {
  return priority ? PRIORITY_META[priority].textClass : "";
}

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Thu, 17 Jul 2026 · 4:30 PM" style line for a node's due date/time, or
 * null if neither is set. */
export function formatDueLine(n: {
  due_date: string | null;
  due_time: string | null;
}): string | null {
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

/** A recurring node counts as "done" only for today's date — it resets
 * automatically once done_on stops matching today. A one-time node, once
 * marked done, stays done (doesn't reset) until the 24h grace-period sweep
 * removes it — see the cleanup effect in WorkPage and toggleDone. */
export function isNodeDone(n: WorkNode, today: string) {
  if (n.task_kind === "one_time") return n.done;
  return n.done && n.done_on === today;
}

/** A held item is only actually hidden while held=true AND (no expiry set,
 * or the expiry hasn't passed yet). Once held_until passes, it's treated as
 * visible again automatically — no extra write needed, this is just a read. */
export function isEffectivelyHeld(held: boolean, heldUntil: string | null) {
  if (!held) return false;
  if (!heldUntil) return true;
  return new Date(heldUntil).getTime() > Date.now();
}

/** A distinct color (separate from the priority palette) for anything whose
 * due date has passed and isn't done yet — this should stand out on its own,
 * regardless of what priority (if any) is also set. */
export const OVERDUE_CLASS = "text-fuchsia-600 dark:text-fuchsia-400";

export function isOverdue(dueDate: string | null, done: boolean, today: string) {
  return !done && !!dueDate && dueDate < today;
}

export type FlatLine = { path: WorkNode[]; leaf: WorkNode };

/** Every node in the tree, each with its full breadcrumb path — used to
 * populate the "Move to" picker (everything is a valid target except the
 * node itself and its own descendants, to avoid creating a cycle). */
export function buildAllPaths(byParent: Map<string | null, WorkNode[]>): FlatLine[] {
  const out: FlatLine[] = [];
  const walk = (parentId: string | null, trail: WorkNode[]) => {
    const kids = byParent.get(parentId) ?? [];
    for (const n of kids) {
      const nextTrail = [...trail, n];
      out.push({ path: nextTrail, leaf: n });
      walk(n.id, nextTrail);
    }
  };
  walk(null, []);
  return out;
}

export function collectDescendantIds(nodeId: string, byParent: Map<string | null, WorkNode[]>) {
  const out = new Set<string>();
  const walk = (id: string) => {
    const kids = byParent.get(id) ?? [];
    for (const k of kids) {
      out.add(k.id);
      walk(k.id);
    }
  };
  walk(nodeId);
  return out;
}

/** Flatten the tree into leaf lines that are NOT done, skipping entire completed subtrees. */
export function buildPendingLines(
  byParent: Map<string | null, WorkNode[]>,
  today: string,
): FlatLine[] {
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
export function buildCompletedLines(
  byParent: Map<string | null, WorkNode[]>,
  today: string,
): FlatLine[] {
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