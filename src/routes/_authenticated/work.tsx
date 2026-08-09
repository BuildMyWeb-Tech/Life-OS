import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, ListPlus, Eye, CheckCircle2, ArrowLeft, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { logicalTodayKey } from "@/lib/storage";
import {
  useWorkNodes,
  useCreateWorkNode,
  useUpdateWorkNode,
  useDeleteWorkNode,
  useReorderWorkNodes,
  useResetAllWorkNodes,
  type WorkNode,
} from "@/features/work-db";
import { TreeLevel } from "@/components/work/TreeView";
import { EditForm, MoveDialog, QuickAddDialog } from "@/components/work/WorkDialogs";
import { CompletedList } from "@/components/work/GroupedLines";
import { PendingWorksTabs } from "@/components/work/PendingWorksTabs";
import { PriorityPicker } from "@/components/work/PriorityControls";
import {
  iconFor,
  isNodeDone,
  buildPendingLines,
  buildCompletedLines,
  type Priority,
} from "@/components/work/work-helpers";

export const Route = createFileRoute("/_authenticated/work")({
  ssr: false,
  component: WorkPage,
});

type ViewMode = "tree" | "pending" | "completed";
const VIEW_KEY = "lifeos:work:view";

function loadView(): ViewMode {
  if (typeof window === "undefined") return "tree";
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === "tree" || v === "pending" || v === "completed") return v;
  } catch {
    /* ignore */
  }
  return "tree";
}

function saveView(v: ViewMode) {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    /* ignore */
  }
}

function WorkPage() {
  const { data: nodes = [] } = useWorkNodes();
  const create = useCreateWorkNode();
  const update = useUpdateWorkNode();
  const del = useDeleteWorkNode();
  const reorder = useReorderWorkNodes();
  const resetAll = useResetAllWorkNodes();

  const [newCompany, setNewCompany] = useState("");
  const [editing, setEditing] = useState<WorkNode | null>(null);
  const [movingNode, setMovingNode] = useState<WorkNode | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [addingUnder, setAddingUnder] = useState<{ parent: WorkNode | null; depth: number } | null>(
    null,
  );
  const [addTitle, setAddTitle] = useState("");
  const addTitleInputRef = useRef<HTMLInputElement>(null);
  const [addKind, setAddKind] = useState<"recurring" | "one_time">("recurring");
  const [addPriority, setAddPriority] = useState<Priority>(null);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [addDueDate, setAddDueDate] = useState("");
  const [addDueTime, setAddDueTime] = useState("");
  const [addIsAsk, setAddIsAsk] = useState(false);
  const [addAskPerson, setAddAskPerson] = useState("");
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
    } catch {
      /* ignore */
    }
  };
  const today = logicalTodayKey();

  // Sweep: any one-time item that's been done for 24h+ gets removed for
  // good. Runs on load and every 5 minutes while the app is open.
  useEffect(() => {
    const sweep = () => {
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      nodes
        .filter(
          (n) =>
            n.task_kind === "one_time" &&
            n.done &&
            n.completed_at &&
            new Date(n.completed_at).getTime() < cutoff,
        )
        .forEach((n) => del.mutate(n.id));
    };
    sweep();
    const iv = window.setInterval(sweep, 5 * 60 * 1000);
    return () => window.clearInterval(iv);
  }, [nodes, del]);

  const [view, setView] = useState<ViewMode>(loadView);
  const changeView = (v: ViewMode) => {
    setView(v);
    saveView(v);
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

  const submitAdd = (keepOpen: boolean) => {
    const t = addTitle.trim();
    if (!t || !addingUnder) return;
    const parent = addingUnder.parent;
    const siblings = byParent.get(parent?.id ?? null) ?? [];
    const type = iconFor(addingUnder.depth).key;
    const canBeOneTime = addingUnder.depth >= 2; // work or task
    create.mutate(
      {
        parent_id: parent?.id ?? null,
        title: t,
        node_type: type,
        sort_order: siblings.length,
        task_kind: canBeOneTime ? addKind : "recurring",
        priority: addPriority,
        due_date: canBeOneTime && addDueDate ? addDueDate : null,
        due_time: canBeOneTime && addDueTime ? `${addDueTime}:00` : null,
        is_ask: addIsAsk,
        ask_person_name: addIsAsk ? addAskPerson.trim() || null : null,
      },
      {
        onSuccess: () => {
          setAddTitle("");
          setAddKind("recurring");
          setAddPriority(null);
          setShowPriorityPicker(false);
          setAddDueDate("");
          setAddDueTime("");
          setAddIsAsk(false);
          setAddAskPerson("");
          if (keepOpen) {
            toast.success("Added — ready for the next one");
            addTitleInputRef.current?.focus();
          } else {
            setAddingUnder(null);
            toast.success("Added");
          }
        },
      },
    );
  };

  const toggleDone = (n: WorkNode) => {
    const currentlyDone = isNodeDone(n, today);
    const nowDone = !currentlyDone;
    if (n.task_kind === "one_time") {
      update.mutate({
        id: n.id,
        done: nowDone,
        done_on: nowDone ? today : null,
        completed_at: nowDone ? new Date().toISOString() : null,
      });
      return;
    }
    update.mutate({
      id: n.id,
      done: nowDone,
      done_on: nowDone ? today : null,
    });
  };

  const setPriority = (n: WorkNode, p: Priority) => {
    update.mutate({ id: n.id, priority: p });
  };

  const toggleDeactivate = (n: WorkNode) => {
    const next = !n.deactivated;
    update.mutate(
      { id: n.id, deactivated: next },
      { onSuccess: () => toast.success(next ? "Deactivated" : "Activated") },
    );
  };

  const moveNode = (newParentId: string | null) => {
    if (!movingNode) return;
    const siblings = byParent.get(newParentId) ?? [];
    update.mutate(
      { id: movingNode.id, parent_id: newParentId, sort_order: siblings.length },
      { onSuccess: () => toast.success("Moved") },
    );
    setMovingNode(null);
  };

  const doneCount = nodes.filter((n) => isNodeDone(n, today)).length;
  const pendingCount = useMemo(() => buildPendingLines(byParent, today).length, [byParent, today]);
  const completedCount = useMemo(
    () => buildCompletedLines(byParent, today).length,
    [byParent, today],
  );

  const resetEverything = () => {
    const ids = nodes.filter((n) => n.done).map((n) => n.id);
    if (ids.length === 0) {
toast.info("Nothing to reset — everything is already pending.");
      return;
    }
    if (
      confirm(`Reset ${ids.length} completed item${ids.length === 1 ? "" : "s"} back to pending?`)
    ) {
      resetAll.mutate(ids);
    }
  };

  const headerTitle =
    view === "pending"
      ? "Pending Works"
      : view === "completed"
        ? "Completed Works"
        : "Work & Projects";
  const headerSubtitle =
    view === "pending"
      ? "Everything that needs attention, in one tabbed view."
      : view === "completed"
        ? "Everything marked done. Untick to move an item back to Pending Works."
        : "Companies → categories → works → tasks. Drag to reorder within a group.";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title={headerTitle} subtitle={headerSubtitle} />
        <div className="flex flex-wrap gap-1.5">
          {view === "tree" && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 px-2.5 text-xs"
                onClick={() => changeView("pending")}
              >
                <Eye className="h-3.5 w-3.5" /> Pending ({pendingCount})
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 px-2.5 text-xs"
                onClick={() => changeView("completed")}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Completed ({completedCount})
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 px-2.5 text-xs"
                onClick={resetEverything}
                title="Move all completed items back to pending"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset ({doneCount})
              </Button>
            </>
          )}
          {view === "pending" && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 px-2.5 text-xs"
                onClick={() => changeView("tree")}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 px-2.5 text-xs"
                onClick={() => changeView("completed")}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Completed ({completedCount})
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 px-2.5 text-xs"
                onClick={resetEverything}
                title="Move all completed items back to pending"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset ({doneCount})
              </Button>
            </>
          )}
          {view === "completed" && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 px-2.5 text-xs"
                onClick={() => changeView("tree")}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 px-2.5 text-xs"
                onClick={() => changeView("pending")}
              >
                <Eye className="h-3.5 w-3.5" /> Pending ({pendingCount})
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 px-2.5 text-xs"
                onClick={resetEverything}
                title="Move all completed items back to pending"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset ({doneCount})
              </Button>
            </>
          )}
        </div>
      </div>

      {view === "pending" && (
        <PendingWorksTabs
          byParent={byParent}
          today={today}
          onToggleDone={toggleDone}
          onSetPriority={setPriority}
          onToggleDeactivate={toggleDeactivate}
        />
      )}

      {view === "completed" && (
        <CompletedList
          byParent={byParent}
          today={today}
          onToggleDone={toggleDone}
          onSetPriority={setPriority}
        />
      )}

      {view === "tree" && (
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
            <Button variant="outline" className="gap-2" onClick={() => setQuickAddOpen(true)}>
              <ListPlus className="h-4 w-4" /> Quick Add
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
              onMove={setMovingNode}
              onToggleDone={toggleDone}
              onSetPriority={setPriority}
              onToggleDeactivate={toggleDeactivate}
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
              ref={addTitleInputRef}
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitAdd(false)}
              placeholder="e.g. Project Development"
            />
          </div>
          <div className="space-y-2 pt-2">
            {showPriorityPicker ? (
              <>
                <Label>Priority</Label>
                <PriorityPicker value={addPriority} onChange={setAddPriority} />
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowPriorityPicker(true)}
                className="text-xs text-primary hover:underline"
              >
                + Set priority              </button>
            )}
          </div>
          <div className="space-y-2 rounded-lg border border-border/60 p-2.5">
            <Label>Ask</Label>
            {/* <p className="text-xs text-muted-foreground">
              Mark this as an ask to show it on the Asks page and the Asks tab of Pending Works,
              with its full company → task path. Default is No.
            </p> */}
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={!addIsAsk ? "default" : "outline"}
                onClick={() => setAddIsAsk(false)}
                className="flex-1"
              >
                No
              </Button>
              <Button
                type="button"
                size="sm"
                variant={addIsAsk ? "default" : "outline"}
                onClick={() => setAddIsAsk(true)}
                className="flex-1"
              >
                Yes
              </Button>
            </div>
            {addIsAsk && (
              <div className="space-y-1 pt-1">
                <Label className="text-xs">Person (optional)</Label>
                <Input
                  value={addAskPerson}
                  onChange={(e) => setAddAskPerson(e.target.value)}
                  placeholder="e.g. Mauli"
                />
              </div>
            )}
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
                  : "Stays for 24 hours after being marked done, then removed automatically."}
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div className="space-y-1">
                  <Label className="text-xs">Due date (optional)</Label>
                  <Input
                    type="date"
                    value={addDueDate}
                    onChange={(e) => setAddDueDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Time (optional)</Label>
                  <Input
                    type="time"
                    value={addDueTime}
                    onChange={(e) => setAddDueTime(e.target.value)}
                  />
                </div>
              </div>
              {addDueDate && addDueTime && (
                <p className="text-xs text-primary">⏰ You'll be reminded at that time.</p>
              )}
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setAddingUnder(null);
                setAddPriority(null);
                setShowPriorityPicker(false);
                setAddIsAsk(false);
                setAddAskPerson("");
              }}
            >
              Cancel
            </Button>
            <Button variant="outline" onClick={() => submitAdd(true)}>
              Save &amp; Add
            </Button>
            <Button onClick={() => submitAdd(false)}>Add</Button>
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
                update.mutate({ id: editing.id, ...patch }, { onSuccess: () => setEditing(null) });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <MoveDialog
        node={movingNode}
        byParent={byParent}
        onClose={() => setMovingNode(null)}
        onMove={moveNode}
      />

      <QuickAddDialog
        open={quickAddOpen}
        byParent={byParent}
        create={create}
        onClose={() => setQuickAddOpen(false)}
      />
    </div>
  );
}