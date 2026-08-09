import { useMemo, useState } from "react";
import { Clock, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useCreateWorkNode, type WorkNode } from "@/features/work-db";
import { PriorityPicker } from "./PriorityControls";
import { buildAllPaths, collectDescendantIds, type Priority } from "./work-helpers";

export function EditForm({
  node,
  onSubmit,
}: {
  node: WorkNode;
  onSubmit: (patch: {
    title: string;
    notes: string | null;
    task_kind: "recurring" | "one_time";
    priority: Priority;
    due_date: string | null;
    due_time: string | null;
    is_ask: boolean;
    ask_person_name: string | null;
  }) => void;
}) {
  const [title, setTitle] = useState(node.title);
  const [notes, setNotes] = useState(node.notes ?? "");
  const [kind, setKind] = useState<"recurring" | "one_time">(node.task_kind ?? "recurring");
  const [priority, setPriority] = useState<Priority>(node.priority ?? null);
  const [dueDate, setDueDate] = useState(node.due_date ?? "");
  const [dueTime, setDueTime] = useState(node.due_time ? node.due_time.slice(0, 5) : "");
  const [isAsk, setIsAsk] = useState(node.is_ask ?? false);
  const [askPerson, setAskPerson] = useState(node.ask_person_name ?? "");
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
      <div className="space-y-1">
        <Label>Priority</Label>
        <PriorityPicker value={priority} onChange={setPriority} />
      </div>
      <div className="space-y-1">
        <Label>Type</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={kind === "recurring" ? "default" : "outline"}
            onClick={() => setKind("recurring")}
            className="flex-1"
          >
            🔁 Recurring
          </Button>
          <Button
            type="button"
            size="sm"
            variant={kind === "one_time" ? "default" : "outline"}
            onClick={() => setKind("one_time")}
            className="flex-1"
          >
            ✅ One-time
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Due date (optional)</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Time (optional)</Label>
          <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
        </div>
      </div>
      {dueDate && dueTime && (
        <p className="text-xs text-primary">⏰ You'll be reminded at that time.</p>
      )}
      <div className="space-y-2 rounded-lg border border-border/60 p-2.5">
        <Label>Ask</Label>
        <p className="text-xs text-muted-foreground">
          Mark this as an ask to show it on the Asks page and the Asks tab of Pending Works, with
          its full company → task path. Default is No.
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={!isAsk ? "default" : "outline"}
            onClick={() => setIsAsk(false)}
            className="flex-1"
          >
            No
          </Button>
          <Button
            type="button"
            size="sm"
            variant={isAsk ? "default" : "outline"}
            onClick={() => setIsAsk(true)}
            className="flex-1"
          >
            Yes
          </Button>
        </div>
        {isAsk && (
          <div className="space-y-1 pt-1">
            <Label className="text-xs">Person (optional)</Label>
            <Input
              value={askPerson}
              onChange={(e) => setAskPerson(e.target.value)}
              placeholder="e.g. Mauli"
            />
          </div>
        )}
      </div>
      <DialogFooter>
        <Button
          onClick={() =>
            onSubmit({
              title: title.trim() || node.title,
              notes: notes.trim() || null,
              task_kind: kind,
              priority,
              due_date: dueDate || null,
              due_time: dueTime ? `${dueTime}:00` : null,
              is_ask: isAsk,
              ask_person_name: isAsk ? askPerson.trim() || null : null,
            })
          }
        >
          Save
        </Button>
      </DialogFooter>
    </div>
  );
}

export function MoveDialog({
  node,
  byParent,
  onClose,
  onMove,
}: {
  node: WorkNode | null;
  byParent: Map<string | null, WorkNode[]>;
  onClose: () => void;
  onMove: (newParentId: string | null) => void;
}) {
  const [target, setTarget] = useState<string>("__root__");

  const options = useMemo(() => {
    if (!node) return [];
    const excluded = collectDescendantIds(node.id, byParent);
    excluded.add(node.id);
    return buildAllPaths(byParent).filter((l) => !excluded.has(l.leaf.id));
  }, [node, byParent]);

  return (
    <Dialog
      open={!!node}
      onOpenChange={(o) => {
        if (!o) {
          setTarget("__root__");
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move "{node?.title}"</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Move to</Label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="__root__">— Top level (new company) —</option>
            {options.map((o) => (
              <option key={o.leaf.id} value={o.leaf.id}>
                {o.path.map((p) => p.title).join(" › ")}
              </option>
            ))}
          </select>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onMove(target === "__root__" ? null : target);
              setTarget("__root__");
            }}
          >
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function QuickAddDialog({
  open,
  byParent,
  create,
  onClose,
}: {
  open: boolean;
  byParent: Map<string | null, WorkNode[]>;
  create: ReturnType<typeof useCreateWorkNode>;
  onClose: () => void;
}) {
  const [companySel, setCompanySel] = useState("__new__");
  const [companyNew, setCompanyNew] = useState("");
  const [categorySel, setCategorySel] = useState("__new__");
  const [categoryNew, setCategoryNew] = useState("");
  const [workSel, setWorkSel] = useState("__new__");
  const [workNew, setWorkNew] = useState("");
  const [taskName, setTaskName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const companies = byParent.get(null) ?? [];
  const categories = companySel !== "__new__" ? (byParent.get(companySel) ?? []) : [];
  const works = categorySel !== "__new__" ? (byParent.get(categorySel) ?? []) : [];

  const reset = () => {
    setCompanySel("__new__");
    setCompanyNew("");
    setCategorySel("__new__");
    setCategoryNew("");
    setWorkSel("__new__");
    setWorkNew("");
    setTaskName("");
  };

  const selectCompany = (v: string) => {
    setCompanySel(v);
    setCategorySel("__new__");
    setCategoryNew("");
    setWorkSel("__new__");
    setWorkNew("");
  };
  const selectCategory = (v: string) => {
    setCategorySel(v);
    setWorkSel("__new__");
    setWorkNew("");
  };

  const submit = async () => {
    if (companySel === "__new__" && !companyNew.trim()) return;
    if (categorySel === "__new__" && !categoryNew.trim()) return;
    if (workSel === "__new__" && !workNew.trim()) return;

    setSubmitting(true);
    try {
      let companyId = companySel;
      if (companySel === "__new__") {
        const created = await create.mutateAsync({
          parent_id: null,
          title: companyNew.trim(),
          node_type: "company",
          sort_order: companies.length,
        });
        companyId = created.id;
      }
      let categoryId = categorySel;
      if (categorySel === "__new__") {
        const siblings = byParent.get(companyId) ?? [];
        const created = await create.mutateAsync({
          parent_id: companyId,
          title: categoryNew.trim(),
          node_type: "category",
          sort_order: siblings.length,
        });
        categoryId = created.id;
      }
      let workId = workSel;
      if (workSel === "__new__") {
        const siblings = byParent.get(categoryId) ?? [];
        const created = await create.mutateAsync({
          parent_id: categoryId,
          title: workNew.trim(),
          node_type: "work",
          sort_order: siblings.length,
        });
        workId = created.id;
      }
      if (taskName.trim()) {
        const siblings = byParent.get(workId) ?? [];
        await create.mutateAsync({
          parent_id: workId,
          title: taskName.trim(),
          node_type: "task",
          sort_order: siblings.length,
        });
      }
      toast.success("Created");
      reset();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quick Add</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Company</Label>
            <select
              value={companySel}
              onChange={(e) => selectCompany(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="__new__">+ New company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            {companySel === "__new__" && (
              <Input
                autoFocus
                className="mt-2"
                placeholder="Company name"
                value={companyNew}
                onChange={(e) => setCompanyNew(e.target.value)}
              />
            )}
          </div>

          <div className="space-y-1">
            <Label>Category</Label>
            {companySel === "__new__" ? (
              <Input
                placeholder="Category name"
                value={categoryNew}
                onChange={(e) => setCategoryNew(e.target.value)}
              />
            ) : (
              <>
                <select
                  value={categorySel}
                  onChange={(e) => selectCategory(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="__new__">+ New category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
                {categorySel === "__new__" && (
                  <Input
                    className="mt-2"
                    placeholder="Category name"
                    value={categoryNew}
                    onChange={(e) => setCategoryNew(e.target.value)}
                  />
                )}
              </>
            )}
          </div>

          <div className="space-y-1">
            <Label>Work</Label>
            {categorySel === "__new__" ? (
              <Input
                placeholder="Work name"
                value={workNew}
                onChange={(e) => setWorkNew(e.target.value)}
              />
            ) : (
              <>
                <select
                  value={workSel}
                  onChange={(e) => setWorkSel(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="__new__">+ New work</option>
                  {works.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.title}
                    </option>
                  ))}
                </select>
                {workSel === "__new__" && (
                  <Input
                    className="mt-2"
                    placeholder="Work name"
                    value={workNew}
                    onChange={(e) => setWorkNew(e.target.value)}
                  />
                )}
              </>
            )}
          </div>

          <div className="space-y-1">
            <Label>Task (optional)</Label>
            <Input
              placeholder="Task name — leave blank to stop at Work"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function HideUntilDialog({
  open,
  itemTitle,
  onClose,
  onConfirm,
}: {
  open: boolean;
  itemTitle: string;
  onClose: () => void;
  onConfirm: (untilIso: string) => void;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const confirm = () => {
    let untilIso: string;
    if (!date && !time) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      untilIso = tomorrow.toISOString();
    } else {
      const d = date || new Date().toISOString().slice(0, 10);
      const t = time || "00:00";
      const dt = new Date(`${d}T${t}:00`);
      if (Number.isNaN(dt.getTime())) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        untilIso = tomorrow.toISOString();
      } else {
        untilIso = dt.toISOString();
      }
    }
    onConfirm(untilIso);
    setDate("");
    setTime("");
  };

  const hideUntilTodayEightPM = () => {
    const d = new Date();
    d.setHours(20, 0, 0, 0);
    onConfirm(d.toISOString());
    setDate("");
    setTime("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setDate("");
          setTime("");
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hide "{itemTitle}"</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Leave both blank to have it reappear automatically at the start of tomorrow, or pick a
            specific date/time.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={hideUntilTodayEightPM}
          >
            <Clock className="h-3.5 w-3.5" /> Today, 8 PM
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Show again on (optional)</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">At (optional)</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={confirm}>
            <EyeOff className="mr-1.5 h-4 w-4" /> Hide
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}