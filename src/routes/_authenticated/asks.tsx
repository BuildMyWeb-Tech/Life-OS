import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2, Clock, AlertTriangle, User, HelpCircle } from "lucide-react";
import { PageHeader, RowActions } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAsks, useCreateAsk, useUpdateAsk, useDeleteAsk, type Ask } from "@/features/asks-db";
import { todayKey } from "@/lib/storage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/asks")({
  ssr: false,
  component: AsksPage,
});

const OVERDUE_CLASS = "text-fuchsia-600 dark:text-fuchsia-400";

function formatDue(a: { due_date: string | null; due_time: string | null }): string | null {
  if (!a.due_date && !a.due_time) return null;
  const parts: string[] = [];
  if (a.due_date) {
    const d = new Date(a.due_date + "T00:00:00");
    parts.push(
      d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }),
    );
  }
  if (a.due_time) {
    const [h, m] = a.due_time.split(":");
    const dt = new Date();
    dt.setHours(Number(h), Number(m), 0, 0);
    parts.push(dt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }));
  }
  return parts.join(" · ");
}

function AsksPage() {
  const { data: asks = [] } = useAsks();
  const create = useCreateAsk();
  const update = useUpdateAsk();
  const del = useDeleteAsk();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Ask | null>(null);

  // Received/done removes it — same pattern as Client Leads, nothing to park
  // in a "done" tab.
  const markReceived = (a: Ask) => del.mutate(a.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asks"
        subtitle='Things you asked someone for — "Get PDF from Mauli, 24 Jul, 6 PM."'
        action={
          <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New ask
          </Button>
        }
      />

      {asks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nothing pending. Add something you're waiting on from someone.
        </div>
      ) : (
        <ul className="space-y-2">
          {asks.map((a) => {
            const due = formatDue(a);
            const overdue = !!a.due_date && a.due_date < todayKey();
            return (
              <li
                key={a.id}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-3"
              >
                <Checkbox
                  checked={false}
                  onCheckedChange={() => markReceived(a)}
                  className="mt-0.5 shrink-0"
                  aria-label="Mark received & remove"
                />
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                  <HelpCircle className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "break-words text-sm font-medium",
                      overdue && cn(OVERDUE_CLASS, "font-semibold"),
                    )}
                  >
                    {a.title}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {a.person_name && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" /> {a.person_name}
                      </span>
                    )}
                    {due && (
                      <span
                        className={cn(
                          "flex items-center gap-1",
                          overdue && cn(OVERDUE_CLASS, "font-medium"),
                        )}
                      >
                        {overdue ? (
                          <AlertTriangle className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        {due}
                        {overdue && " · Overdue"}
                      </span>
                    )}
                  </div>
                  {a.notes && <p className="mt-0.5 text-xs text-muted-foreground">{a.notes}</p>}
                </div>
                <RowActions
                  actions={[
                    {
                      label: "Edit",
                      icon: <Pencil className="h-4 w-4" />,
                      onClick: () => setEditing(a),
                    },
                    {
                      label: "Delete",
                      icon: <Trash2 className="h-4 w-4" />,
                      onClick: () => del.mutate(a.id),
                      destructive: true,
                    },
                  ]}
                />
              </li>
            );
          })}
        </ul>
      )}

      <AskFormDialog
        open={open}
        title="New ask"
        initial={null}
        onClose={() => setOpen(false)}
        onSubmit={(patch) => {
          create.mutate({ ...patch, sort_order: asks.length }, { onSuccess: () => setOpen(false) });
        }}
      />

      <AskFormDialog
        open={!!editing}
        title="Edit ask"
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

function AskFormDialog({
  open,
  title,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initial: Ask | null;
  onClose: () => void;
  onSubmit: (patch: {
    title: string;
    person_name: string | null;
    notes: string | null;
    due_date: string | null;
    due_time: string | null;
  }) => void;
}) {
  const [askTitle, setAskTitle] = useState(initial?.title ?? "");
  const [person, setPerson] = useState(initial?.person_name ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [dueDate, setDueDate] = useState(initial?.due_date ?? "");
  const [dueTime, setDueTime] = useState(initial?.due_time ? initial.due_time.slice(0, 5) : "");

  const key = initial?.id ?? "new";
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setAskTitle(initial?.title ?? "");
    setPerson(initial?.person_name ?? "");
    setNotes(initial?.notes ?? "");
    setDueDate(initial?.due_date ?? "");
    setDueTime(initial?.due_time ? initial.due_time.slice(0, 5) : "");
  }

  const submit = () => {
    const trimmed = askTitle.trim();
    if (!trimmed) return;
    onSubmit({
      title: trimmed,
      person_name: person.trim() || null,
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
            <Label>What did you ask for</Label>
            <Input
              autoFocus
              value={askTitle}
              onChange={(e) => setAskTitle(e.target.value)}
              placeholder="e.g. Get PDF"
            />
          </div>
          <div className="space-y-1">
            <Label>Person (optional)</Label>
            <Input
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="e.g. Mauli"
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
          <Button onClick={submit} disabled={!askTitle.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}