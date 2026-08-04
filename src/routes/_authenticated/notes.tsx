import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, StickyNote, FolderOpen } from "lucide-react";
import { PageHeader, RowActions } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  useNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  type Note,
} from "@/features/notes-db";

export const Route = createFileRoute("/_authenticated/notes")({
  ssr: false,
  component: NotesPage,
});

const CATEGORY_FILTER_KEY = "lifeos:notes:category-filter";

function loadCategoryFilter(): string {
  if (typeof window === "undefined") return "__all__";
  try {
    return localStorage.getItem(CATEGORY_FILTER_KEY) ?? "__all__";
  } catch {
    return "__all__";
  }
}

function NotesPage() {
  const { data: notes = [] } = useNotes();
  const create = useCreateNote();
  const update = useUpdateNote();
  const del = useDeleteNote();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [viewing, setViewing] = useState<Note | null>(null);
  const [categoryFilter, setCategoryFilterState] = useState<string>(loadCategoryFilter);

  const setCategoryFilter = (v: string) => {
    setCategoryFilterState(v);
    try {
      localStorage.setItem(CATEGORY_FILTER_KEY, v);
    } catch {
      /* ignore */
    }
  };

  const categories = useMemo(() => {
    const names = new Set<string>();
    notes.forEach((n) => names.add(n.category?.trim() || "Uncategorized"));
    return [...names].sort();
  }, [notes]);

  const visible = useMemo(() => {
    if (categoryFilter === "__all__") return notes;
    return notes.filter((n) => (n.category?.trim() || "Uncategorized") === categoryFilter);
  }, [notes, categoryFilter]);

  const groups = useMemo(() => {
    const m = new Map<string, Note[]>();
    for (const n of visible) {
      const key = n.category?.trim() || "Uncategorized";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(n);
    }
    return m;
  }, [visible]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notes"
        subtitle="Longer things worth keeping — grouped by category."
        action={
          <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New note
          </Button>
        }
      />

      {categories.length > 0 && (
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No notes yet. Add one to get started.
        </div>
      ) : (
        <div className="space-y-4">
          {[...groups.entries()].map(([categoryName, items]) => (
            <div key={categoryName} className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{categoryName}</p>
                <span className="text-xs text-muted-foreground">· {items.length}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => setViewing(n)}
                    className="flex flex-col items-start gap-1 rounded-xl border border-border bg-secondary/20 p-3 text-left transition hover:bg-secondary/40"
                  >
                    <div className="flex w-full items-start justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <StickyNote className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        {n.title}
                      </p>
                      <RowActions
                        actions={[
                          {
                            label: "Edit",
                            icon: <Pencil className="h-4 w-4" />,
                            onClick: () => setEditing(n),
                          },
                          {
                            label: "Delete",
                            icon: <Trash2 className="h-4 w-4" />,
                            onClick: () => del.mutate(n.id),
                            destructive: true,
                          },
                        ]}
                      />
                    </div>
                    {n.description && (
                      <p className="line-clamp-3 text-xs text-muted-foreground">{n.description}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View note */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewing?.title}</DialogTitle>
          </DialogHeader>
          {viewing?.category && (
            <span className="w-fit rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {viewing.category}
            </span>
          )}
          <p className="whitespace-pre-wrap text-sm text-foreground/90">
            {viewing?.description || "No description."}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (viewing) setEditing(viewing);
                setViewing(null);
              }}
            >
              <Pencil className="mr-1.5 h-4 w-4" /> Edit
            </Button>
            <Button variant="ghost" onClick={() => setViewing(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add note */}
      <NoteFormDialog
        open={open}
        title="New note"
        initial={null}
        onClose={() => setOpen(false)}
        onSubmit={(patch) => {
          create.mutate(
            { ...patch, sort_order: notes.length },
            { onSuccess: () => setOpen(false) },
          );
        }}
      />

      {/* Edit note */}
      <NoteFormDialog
        open={!!editing}
        title="Edit note"
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

function NoteFormDialog({
  open,
  title,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initial: Note | null;
  onClose: () => void;
  onSubmit: (patch: { title: string; category: string | null; description: string | null }) => void;
}) {
  const [noteTitle, setNoteTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");

  const key = initial?.id ?? "new";
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setNoteTitle(initial?.title ?? "");
    setCategory(initial?.category ?? "");
    setDescription(initial?.description ?? "");
  }

  const submit = () => {
    const trimmed = noteTitle.trim();
    if (!trimmed) return;
    onSubmit({
      title: trimmed,
      category: category.trim() || null,
      description: description.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Title</Label>
            <Input
              autoFocus
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="e.g. Client onboarding checklist"
            />
          </div>
          <div className="space-y-1">
            <Label>Category (optional)</Label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Work, Ideas, Personal"
            />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={10}
              placeholder="Write as much as you need…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!noteTitle.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}