import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2, Clock, AlertTriangle, ArrowLeft, PhoneCall } from "lucide-react";
import { PageHeader, RowActions } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useClientCalls,
  useCreateClientCall,
  useUpdateClientCall,
  useDeleteClientCall,
  type ClientCall,
} from "@/features/client-calls-db";
import { todayKey } from "@/lib/storage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/client-calls")({
  ssr: false,
  component: ClientCallsPage,
});

const OVERDUE_CLASS = "text-fuchsia-600 dark:text-fuchsia-400";

function formatDue(c: { due_date: string | null; due_time: string | null }): string | null {
  if (!c.due_date && !c.due_time) return null;
  const parts: string[] = [];
  if (c.due_date) {
    const d = new Date(c.due_date + "T00:00:00");
    parts.push(
      d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }),
    );
  }
  if (c.due_time) {
    const [h, m] = c.due_time.split(":");
    const dt = new Date();
    dt.setHours(Number(h), Number(m), 0, 0);
    parts.push(dt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }));
  }
  return parts.join(" · ");
}

function ClientCallsPage() {
  const { data: calls = [] } = useClientCalls();
  const create = useCreateClientCall();
  const update = useUpdateClientCall();
  const del = useDeleteClientCall();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClientCall | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          title="Client Call Management"
          subtitle="Numbers to follow up with — tap a number to call it."
          action={
            <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Add contact
            </Button>
          }
        />
      </div>
      <Link to="/work">
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <ArrowLeft className="h-3.5 w-3.5" /> Work & Projects
        </Button>
      </Link>

     {calls.length === 0 ? (
  <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
    No contacts yet. Add one to get started.
  </div>
) : (
  <ul className="space-y-2">
    {calls.map((c) => {
      const due = formatDue(c);
      const overdue = !!c.due_date && c.due_date < todayKey();

      return (
        <li
          key={c.id}
          className="flex items-start gap-3 rounded-xl border border-border bg-card p-3"
        >
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
            <PhoneCall className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "break-words text-sm font-medium",
                overdue && cn(OVERDUE_CLASS, "font-semibold")
              )}
            >
              {c.name}
            </p>

            <a
              href={`tel:${c.phone.replace(/\s+/g, "")}`}
              className="mt-0.5 inline-block text-sm text-primary hover:underline"
            >
              {c.phone}
            </a>

            {due && (
              <span
                className={cn(
                  "mt-0.5 flex items-center gap-1 text-xs",
                  overdue
                    ? cn(OVERDUE_CLASS, "font-medium")
                    : "text-muted-foreground"
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

            {c.notes && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {c.notes}
              </p>
            )}
          </div>

          <RowActions
            actions={[
              {
                label: "Edit",
                icon: <Pencil className="h-4 w-4" />,
                onClick: () => setEditing(c),
              },
              {
                label: "Delete",
                icon: <Trash2 className="h-4 w-4" />,
                onClick: () => del.mutate(c.id),
                destructive: true,
              },
            ]}
          />
        </li>
      );
    })}
  </ul>
)}

      <CallFormDialog
        open={open}
        title="Add contact"
        initial={null}
        onClose={() => setOpen(false)}
        onSubmit={(patch) => {
          create.mutate(
            { ...patch, sort_order: calls.length },
            { onSuccess: () => setOpen(false) },
          );
        }}
      />

      <CallFormDialog
        open={!!editing}
        title="Edit contact"
        initial={editing}
        onClose={() => setEditing(null)}
        onSubmit={(patch) => {
          if (!editing) return;
          update.mutate({ id: editing.id, ...patch }, { onSuccess: () => setEditing(null) });
        }}
      />
    </div>
  );
}

function CallFormDialog({
  open,
  title,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initial: ClientCall | null;
  onClose: () => void;
  onSubmit: (patch: {
    name: string;
    phone: string;
    notes: string | null;
    due_date: string | null;
    due_time: string | null;
  }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [dueDate, setDueDate] = useState(initial?.due_date ?? "");
  const [dueTime, setDueTime] = useState(initial?.due_time ? initial.due_time.slice(0, 5) : "");

  const key = initial?.id ?? "new";
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setName(initial?.name ?? "");
    setPhone(initial?.phone ?? "");
    setNotes(initial?.notes ?? "");
    setDueDate(initial?.due_date ?? "");
    setDueTime(initial?.due_time ? initial.due_time.slice(0, 5) : "");
  }

  const submit = () => {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName || !trimmedPhone) return;
    onSubmit({
      name: trimmedName,
      phone: trimmedPhone,
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
              placeholder="e.g. Sanjai"
            />
          </div>
          <div className="space-y-1">
            <Label>Phone number</Label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="e.g. +91 98765 43210"
            />
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
          <Button onClick={submit} disabled={!name.trim() || !phone.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}