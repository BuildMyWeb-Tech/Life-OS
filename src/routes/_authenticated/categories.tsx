import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Tags, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useHabits,
} from "@/features/habits-db";

export const Route = createFileRoute("/_authenticated/categories")({
  ssr: false,
  component: CategoriesPage,
});

const PRESETS = [
  "#f59e0b", "#06b6d4", "#f97316", "#6366f1",
  "#10b981", "#0ea5e9", "#84cc16", "#a855f7",
  "#ef4444", "#ec4899", "#22c55e", "#eab308",
];

function CategoriesPage() {
  const { data: cats = [] } = useCategories();
  const { data: habits = [] } = useHabits();
  const create = useCreateCategory();
  const del = useDeleteCategory();
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESETS[0]);

  const countFor = (id: string) => habits.filter((h) => h.category_id === id).length;

  const add = () => {
    if (!name.trim()) return;
    create.mutate({ name: name.trim(), color });
    setName("");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader
        title="Habit Categories"
        subtitle="Group your habits by routine, area of life, or goal."
      />

      <div className="glass mb-6 rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="New category name"
            className="min-w-[180px] flex-1 bg-transparent"
          />
          <Button onClick={add} className="gap-2"><Plus className="h-4 w-4" /> Add</Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="h-7 w-7 rounded-full border-2 transition"
              style={{
                background: c,
                borderColor: color === c ? "white" : "transparent",
              }}
              aria-label={`color ${c}`}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cats.map((c) => (
          <div key={c.id} className="glass flex items-center gap-3 rounded-2xl p-4">
            <span
              className="grid h-10 w-10 place-items-center rounded-xl"
              style={{ background: c.color }}
            >
              <Tags className="h-5 w-5 text-white" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{c.name}</p>
              <p className="text-xs text-muted-foreground">{countFor(c.id)} habits</p>
            </div>
            <Button size="icon" variant="ghost" onClick={() => del.mutate(c.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
