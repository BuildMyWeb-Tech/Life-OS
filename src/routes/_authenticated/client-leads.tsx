import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Clock,
  AlertTriangle,
  ArrowLeft,
  ListPlus,
  Building2,
} from "lucide-react";
import { PageHeader, RowActions } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useClientLeads,
  useCreateClientLead,
  useUpdateClientLead,
  useDeleteClientLead,
  useBulkCreateClientLeads,
  type ClientLead,
} from "@/features/client-leads-db";
import { cn } from "@/lib/utils";
import { todayKey } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/client-leads")({
  ssr: false,
  component: ClientLeadsPage,
});

const PRIORITY_TEXT: Record<string, string> = {
  low: "text-sky-600 dark:text-sky-400",
  medium: "text-amber-700/70 dark:text-amber-300/60",
  high: "text-red-600 dark:text-red-400",
};

const OVERDUE_CLASS = "text-fuchsia-600 dark:text-fuchsia-400";

function formatDue(l: { due_date: string | null; due_time: string | null }): string | null {
  if (!l.due_date && !l.due_time) return null;
  const parts: string[] = [];
  if (l.due_date) {
    const d = new Date(l.due_date + "T00:00:00");
    parts.push(
      d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }),
    );
  }
  if (l.due_time) {
    const [h, m] = l.due_time.split(":");
    const dt = new Date();
    dt.setHours(Number(h), Number(m), 0, 0);
    parts.push(dt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }));
  }
  return parts.join(" · ");
}

type LeadFilter = "all" | "pending" | "completed";

function ClientLeadsPage() {
  const { data: leads = [] } = useClientLeads();
  const create = useCreateClientLead();
  const update = useUpdateClientLead();
  const del = useDeleteClientLead();
  const bulkCreate = useBulkCreateClientLeads();

  const [filter, setFilter] = useState<LeadFilter>("pending");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClientLead | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkGroup, setBulkGroup] = useState("Discussion for Future Client");
  const [bulkText, setBulkText] = useState("");

  const visible = useMemo(() => {
    return leads.filter((l) => {
      if (filter === "pending") return !l.completed;
      if (filter === "completed") return l.completed;
      return true;
    });
  }, [leads, filter]);

  const groups = useMemo(() => {
    const m = new Map<string, ClientLead[]>();
    for (const l of visible) {
      const key = l.group_name?.trim() || "Ungrouped";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(l);
    }
    return m;
  }, [visible]);

  const submitBulk = () => {
    const names = bulkText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    bulkCreate.mutate(
      { names, group_name: bulkGroup.trim() || null, startOrder: leads.length },
      { onSuccess: () => setBulkText("") },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          title="Client Acquisition"
          subtitle="Leads and follow-up discussions, tracked to closed."
        />
        <Link to="/work">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" /> Work & Projects
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as LeadFilter)}>
          <TabsList className="grid grid-cols-3 sm:w-auto">
            <TabsTrigger value="all">All ({leads.length})</TabsTrigger>
            <TabsTrigger value="pending">
              Pending ({leads.filter((l) => !l.completed).length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Done ({leads.filter((l) => l.completed).length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setBulkOpen(true)}>
            <ListPlus className="h-4 w-4" /> Bulk add
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add lead
          </Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No {filter === "all" ? "leads" : filter} yet.
        </div>
      ) : (
        <div className="space-y-4">
          {[...groups.entries()].map(([groupName, items]) => (
            <div key={groupName} className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{groupName}</p>
                <span className="text-xs text-muted-foreground">· {items.length}</span>
              </div>
              <div className="space-y-1.5">
                {items.map((l) => {
                  const due = formatDue(l);
                  const overdue = !l.completed && !!l.due_date && l.due_date < todayKey();
                  return (
                    <div
                      key={l.id}
                      className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/30"
                    >
                      <Checkbox
                        checked={l.completed}
                        onCheckedChange={(v) => update.mutate({ id: l.id, completed: !!v })}
                        className="mt-0.5 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "break-words font-medium leading-snug",
                            l.completed
                              ? "text-muted-foreground line-through"
                              : overdue
                                ? cn(OVERDUE_CLASS, "font-semibold")
                                : l.priority
                                  ? PRIORITY_TEXT[l.priority]
                                  : "text-foreground",
                          )}
                        >
                          {l.name}
                        </p>
                        {due && (
                          <span
                            className={cn(
                              "mt-0.5 flex items-center gap-1 text-xs",
                              overdue ? cn(OVERDUE_CLASS, "font-medium") : "text-muted-foreground",
                            )}
                          >
                            {overdue ? (
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                            ) : (
                              <Clock className="h-3 w-3 shrink-0" />
                            )}
                            {due}
                            {overdue && " · Overdue"}
                          </span>
                        )}
                        {l.notes && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{l.notes}</p>
                        )}
                      </div>
                      <RowActions
                        actions={[
                          {
                            label: "Edit",
                            icon: <Pencil className="h-4 w-4" />,
                            onClick: () => setEditing(l),
                          },
                          {
                            label: "Delete",
                            icon: <Trash2 className="h-4 w-4" />,
                            onClick: () => del.mutate(l.id),
                            destructive: true,
                          },
                        ]}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add lead dialog */}
      <LeadFormDialog
        open={open}
        title="Add lead"
        initial={null}
        onClose={() => setOpen(false)}
        onSubmit={(patch) => {
          create.mutate(
            { ...patch, sort_order: leads.length },
            { onSuccess: () => setOpen(false) },
          );
        }}
      />

      {/* Edit lead dialog */}
      <LeadFormDialog
        open={!!editing}
        title="Edit lead"
        initial={editing}
        onClose={() => setEditing(null)}
        onSubmit={(patch) => {
          if (!editing) return;
          update.mutate({ id: editing.id, ...patch }, { onSuccess: () => setEditing(null) });
        }}
      />

      {/* Bulk add dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk add leads</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Group name</Label>
              <Input value={bulkGroup} onChange={(e) => setBulkGroup(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Names (one per line)</Label>
              <Textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={10}
                placeholder={"Harish Hst\nSanjai\nSM Travels\n…"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                submitBulk();
                setBulkOpen(false);
              }}
            >
              Add all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LeadFormDialog({
  open,
  title,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initial: ClientLead | null;
  onClose: () => void;
  onSubmit: (patch: {
    name: string;
    group_name: string | null;
    priority: "low" | "medium" | "high" | null;
    notes: string | null;
    due_date: string | null;
    due_time: string | null;
  }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [group, setGroup] = useState(initial?.group_name ?? "");
  const [priority, setPriority] = useState<string>(initial?.priority ?? "none");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [dueDate, setDueDate] = useState(initial?.due_date ?? "");
  const [dueTime, setDueTime] = useState(initial?.due_time ? initial.due_time.slice(0, 5) : "");

  // Re-hydrate the form whenever a different (or no) lead is being edited.
  const key = initial?.id ?? "new";
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setName(initial?.name ?? "");
    setGroup(initial?.group_name ?? "");
    setPriority(initial?.priority ?? "none");
    setNotes(initial?.notes ?? "");
    setDueDate(initial?.due_date ?? "");
    setDueTime(initial?.due_time ? initial.due_time.slice(0, 5) : "");
  }

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({
      name: trimmed,
      group_name: group.trim() || null,
      priority: priority === "none" ? null : (priority as "low" | "medium" | "high"),
      notes: notes.trim() || null,
      due_date: dueDate || null,
      due_time: dueTime ? `${dueTime}:00` : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="e.g. Harish Hst"
            />
          </div>
          <div className="space-y-1">
            <Label>Group (optional)</Label>
            <Input
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              placeholder="e.g. Discussion for Future Client"
            />
          </div>
          <div className="space-y-1">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Date (optional)</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Time (optional)</Label>
              <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}