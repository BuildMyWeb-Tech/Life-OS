import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
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
import { motion } from "framer-motion";
import {
  GripVertical,
  ImagePlus,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import { PageHeader, RowActions } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useVisionPoints,
  useCreateVisionPoint,
  useUpdateVisionPoint,
  useDeleteVisionPoint,
  useReorderVisionPoints,
  useVisionImages,
  useVisionImageUrls,
  useUploadVisionImages,
  useDeleteVisionImage,
  type VisionPoint,
} from "@/features/vision-board-db";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/vision-board")({
  ssr: false,
  component: VisionBoardPage,
});

function VisionBoardPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Vision Board"
        subtitle="Your manifestation points and vision images, all in one place."
        action={<Wand2 className="hidden h-6 w-6 text-primary sm:block" />}
      />
      <PointsSection />
      <ImagesSection />
    </div>
  );
}

function PointsSection() {
  const { data: points = [] } = useVisionPoints();
  const create = useCreateVisionPoint();
  const update = useUpdateVisionPoint();
  const del = useDeleteVisionPoint();
  const reorder = useReorderVisionPoints();

  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const add = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    create.mutate({ text: trimmed, sort_order: points.length });
    setText("");
  };

  const startEdit = (p: VisionPoint) => {
    setEditingId(p.id);
    setEditText(p.text);
  };

  const saveEdit = () => {
    if (!editingId) return;
    const trimmed = editText.trim();
    if (trimmed) update.mutate({ id: editingId, text: trimmed });
    setEditingId(null);
    setEditText("");
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = points.findIndex((p) => p.id === active.id);
    const newIdx = points.findIndex((p) => p.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(points, oldIdx, newIdx).map((p, i) => ({ id: p.id, sort_order: i }));
    reorder.mutate(next);
  };

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <Sparkles className="h-4 w-4" /> Points ({points.length})
      </h2>

      <div className="glass flex gap-2 rounded-2xl p-3">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="e.g. I run a thriving product studio"
          className="bg-transparent"
        />
        <Button onClick={add} className="gap-2">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {points.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card/40 p-6 text-sm text-muted-foreground">
          No points yet. Write down what you're manifesting above.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={points.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {points.map((p) => (
                <SortablePointRow
                  key={p.id}
                  point={p}
                  editing={editingId === p.id}
                  editText={editText}
                  onEditTextChange={setEditText}
                  onStartEdit={() => startEdit(p)}
                  onSaveEdit={saveEdit}
                  onCancelEdit={() => setEditingId(null)}
                  onDelete={() => del.mutate(p.id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}

function SortablePointRow({
  point,
  editing,
  editText,
  onEditTextChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
}: {
  point: VisionPoint;
  editing: boolean;
  editText: string;
  onEditTextChange: (v: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: point.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="glass flex items-center gap-3 rounded-xl px-3 py-3"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab p-1 text-muted-foreground hover:text-foreground"
        aria-label="drag"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {editing ? (
        <div className="flex min-w-0 flex-1 gap-2">
          <Input
            autoFocus
            value={editText}
            onChange={(e) => onEditTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveEdit();
              if (e.key === "Escape") onCancelEdit();
            }}
          />
          <Button size="sm" onClick={onSaveEdit}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancelEdit}>
            Cancel
          </Button>
        </div>
      ) : (
        <p className="min-w-0 flex-1 break-words text-sm font-medium">{point.text}</p>
      )}

      {!editing && (
        <RowActions
          actions={[
            { label: "Edit", icon: <Pencil className="h-4 w-4" />, onClick: onStartEdit },
            {
              label: "Delete",
              icon: <Trash2 className="h-4 w-4" />,
              onClick: onDelete,
              destructive: true,
            },
          ]}
        />
      )}
    </li>
  );
}

function ImagesSection() {
  const { data: images = [] } = useVisionImages();
  const { data: urls = {} } = useVisionImageUrls(images);
  const upload = useUploadVisionImages();
  const del = useDeleteVisionImage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    upload.mutate(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <ImagePlus className="h-4 w-4" /> Images ({images.length})
        </h2>
        <Button
          size="sm"
          className="gap-2"
          onClick={() => fileInputRef.current?.click()}
          disabled={upload.isPending}
        >
          <Upload className="h-4 w-4" /> {upload.isPending ? "Uploading…" : "Upload images"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {images.length === 0 ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/40 p-10 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground"
        >
          <ImagePlus className="h-8 w-8" />
          Tap to upload your first vision images
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((img) => (
            <motion.div
              key={img.id}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "group relative aspect-square overflow-hidden rounded-xl border border-border bg-secondary/30",
              )}
            >
              {urls[img.id] ? (
                <img
                  src={urls[img.id]}
                  alt={img.caption ?? "Vision board image"}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                  Loading…
                </div>
              )}
              <button
                onClick={() => del.mutate(img)}
                aria-label="Delete image"
                className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1.5 opacity-0 transition-opacity group-hover:opacity-100 sm:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5 text-white" />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}