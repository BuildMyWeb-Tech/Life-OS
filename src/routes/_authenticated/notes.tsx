import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Pencil,
  Trash2,
  StickyNote,
  FolderOpen,
  Copy,
  Check,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
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

const UNCATEGORIZED = "Uncategorized";
const CATEGORY_ORDER_KEY = "lifeos:notes:category-order";

function loadCategoryOrder(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CATEGORY_ORDER_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveCategoryOrder(order: string[]) {
  try {
    localStorage.setItem(CATEGORY_ORDER_KEY, JSON.stringify(order));
  } catch {
    /* ignore */
  }
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={async (e) => {
        e.stopPropagation();
        const ok = await copyToClipboard(text);
        if (ok) {
          setCopied(true);
          toast.success("Copied to clipboard");
          window.setTimeout(() => setCopied(false), 1500);
        } else {
          toast.error("Couldn't copy — try selecting the text manually");
        }
      }}
      className="shrink-0 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">{copied ? "Copied" : label}</span>
    </Button>
  );
}

function NotesPage() {
  const { data: notes = [] } = useNotes();
  const create = useCreateNote();
  const update = useUpdateNote();
  const del = useDeleteNote();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [viewing, setViewing] = useState<Note | null>(null);
  const [categoryOrder, setCategoryOrder] = useState<string[]>(loadCategoryOrder);

  const categoryNames = useMemo(() => {
    const names = new Set<string>();
    notes.forEach((n) => names.add(n.category?.trim() || UNCATEGORIZED));
    return [...names];
  }, [notes]);

  const orderedCategoryNames = useMemo(() => {
    const known = categoryOrder.filter((c) => categoryNames.includes(c));
    const missing = categoryNames.filter((c) => !known.includes(c));
    return [...known, ...missing];
  }, [categoryOrder, categoryNames]);

  const groups = useMemo(() => {
    const m = new Map<string, Note[]>();
    for (const n of notes) {
      const key = n.category?.trim() || UNCATEGORIZED;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(n);
    }
    return m;
  }, [notes]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = orderedCategoryNames.indexOf(String(active.id));
    const newIdx = orderedCategoryNames.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(orderedCategoryNames, oldIdx, newIdx);
    setCategoryOrder(next);
    saveCategoryOrder(next);
  };

  return (
    <div className="w-full min-w-0 space-y-6 overflow-x-hidden">
      <PageHeader
        title="Notes"
        subtitle="Longer things worth keeping — drag a category to reorder it."
        action={
          <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New note
          </Button>
        }
      />

      {notes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No notes yet. Add one to get started.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedCategoryNames} strategy={verticalListSortingStrategy}>
            <div className="w-full min-w-0 space-y-4">
              {orderedCategoryNames.map((categoryName) => {
                const items = groups.get(categoryName) ?? [];
                if (!items.length) return null;
                return (
                  <CategoryGroup key={categoryName} id={categoryName}>
                    <div className="mb-2 flex min-w-0 items-center gap-2">
                      <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
                      <p className="min-w-0 truncate text-sm font-semibold">{categoryName}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        · {items.length}
                      </span>
                    </div>
                    <div className="grid w-full min-w-0 gap-2 sm:grid-cols-2">
                      {items.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => setViewing(n)}
                          className="flex min-w-0 flex-col items-start gap-1 rounded-xl border border-border bg-secondary/20 p-3 text-left transition hover:bg-secondary/40"
                        >
                          <div className="flex w-full min-w-0 items-start justify-between gap-2">
                            <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                              <StickyNote className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <span className="truncate">{n.title}</span>
                            </p>
                            <div className="flex shrink-0 items-center">
                              {n.description && <CopyButton text={n.description} label="" />}
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
                          </div>
                          {n.description && (
                            <p className="line-clamp-3 w-full min-w-0 break-words text-xs text-muted-foreground">
                              {n.description}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  </CategoryGroup>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* View note */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] overflow-y-auto sm:w-full">
          <DialogHeader>
            <DialogTitle className="break-words pr-6">{viewing?.title}</DialogTitle>
          </DialogHeader>
          {viewing?.category && (
            <span className="w-fit rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {viewing.category}
            </span>
          )}
          <p className="whitespace-pre-wrap break-words text-sm text-foreground/90">
            {viewing?.description || "No description."}
          </p>
          <DialogFooter className="flex-wrap gap-2">
            {viewing?.description && (
              <Button
                variant="outline"
                onClick={async () => {
                  const ok = await copyToClipboard(viewing.description ?? "");
                  if (ok) toast.success("Copied to clipboard");
                  else toast.error("Couldn't copy — try selecting the text manually");
                }}
              >
                <Copy className="mr-1.5 h-4 w-4" /> Copy description
              </Button>
            )}
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

      <NoteFormDialog
        key={`new-${open}`}
        open={open}
        title="New note"
        initial={null}
        categoryNames={categoryNames}
        onClose={() => setOpen(false)}
        onSubmit={(patch) => {
          create.mutate(
            { ...patch, sort_order: notes.length },
            { onSuccess: () => setOpen(false) },
          );
        }}
      />

      <NoteFormDialog
        key={editing?.id ?? "edit-closed"}
        open={!!editing}
        title="Edit note"
        initial={editing}
        categoryNames={categoryNames}
        onClose={() => setEditing(null)}
        onSubmit={(patch) => {
          if (!editing) return;
          update.mutate({ id: editing.id, ...patch }, { onSuccess: () => setEditing(null) });
        }}
      />
    </div>
  );
}

function CategoryGroup({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="w-full min-w-0 rounded-2xl border border-border bg-card p-4"
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Drag to reorder category"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="w-full min-w-0">{children}</div>
      </div>
    </div>
  );
}

function CategoryPicker({
  value,
  categoryNames,
  onChange,
}: {
  value: string;
  categoryNames: string[];
  onChange: (v: string) => void;
}) {
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");

  return (
    <div className="space-y-1">
      <Label>Category (optional)</Label>
      <Select
        value={value || "__none__"}
        onValueChange={(v) => {
          if (v === "__create__") {
            setNewName("");
            setNewOpen(true);
            return;
          }
          onChange(v === "__none__" ? "" : v);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="No category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">No category</SelectItem>
          {categoryNames
            .filter((c) => c !== UNCATEGORIZED)
            .map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          <SelectItem value="__create__">+ Create new category…</SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New category</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <Label>Category name</Label>
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) {
                  onChange(newName.trim());
                  setNewOpen(false);
                }
              }}
              placeholder="e.g. Work, Ideas, Personal"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!newName.trim()}
              onClick={() => {
                onChange(newName.trim());
                setNewOpen(false);
              }}
            >
              Create &amp; use
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NoteFormDialog({
  open,
  title,
  initial,
  categoryNames,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initial: Note | null;
  categoryNames: string[];
  onClose: () => void;
  onSubmit: (patch: { title: string; category: string | null; description: string | null }) => void;
}) {
  const [noteTitle, setNoteTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");

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
      <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] overflow-y-auto sm:w-full">
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
          <CategoryPicker value={category} categoryNames={categoryNames} onChange={setCategory} />
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