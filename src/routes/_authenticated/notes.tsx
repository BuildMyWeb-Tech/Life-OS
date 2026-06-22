import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLocal } from "@/lib/storage";
import { toast } from "sonner";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/notes")({
  ssr: false,
  component: NotesPage,
});

type Note = { id: string; title: string; body: string; updated: number };
type NotesState = { daily: Note[]; weekly: Note[]; monthly: Note[] };
const EMPTY: NotesState = { daily: [], weekly: [], monthly: [] };
const newId = () => Math.random().toString(36).slice(2, 10);

function NotesPage() {
  const [state, setState] = useLocal<NotesState>("lifeos:notes", EMPTY);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader title="Notes" subtitle="Thoughts, reflections, plans." />
      <Tabs defaultValue="daily">
        <TabsList>
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
        </TabsList>
        {(["daily", "weekly", "monthly"] as const).map((k) => (
          <TabsContent key={k} value={k} className="mt-6">
            <NoteList
              notes={state[k]}
              onChange={(notes) => setState((s) => ({ ...s, [k]: notes }))}
            />
          </TabsContent>
        ))}
      </Tabs>
    </motion.div>
  );
}

function NoteList({ notes, onChange }: { notes: Note[]; onChange: (n: Note[]) => void }) {
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");

  const add = () => {
    if (!draftTitle.trim() && !draftBody.trim()) return;
    const note: Note = { id: newId(), title: draftTitle.trim() || "Untitled", body: draftBody, updated: Date.now() };
    onChange([note, ...notes]);
    setDraftTitle("");
    setDraftBody("");
    toast.success("Note saved");
  };

  const update = (id: string, patch: Partial<Note>) => {
    onChange(notes.map((n) => (n.id === id ? { ...n, ...patch, updated: Date.now() } : n)));
  };
  const remove = (id: string) => onChange(notes.filter((n) => n.id !== id));

  return (
    <div className="space-y-4">
      <div className="glass space-y-3 rounded-2xl p-4">
        <Input placeholder="Title" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} />
        <Textarea rows={4} placeholder="Write something..." value={draftBody} onChange={(e) => setDraftBody(e.target.value)} />
        <div className="flex justify-end">
          <Button onClick={add} className="gap-2"><Plus className="h-4 w-4" /> Save Note</Button>
        </div>
      </div>
      {notes.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">No notes yet.</p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {notes.map((n) => (
          <div key={n.id} className="glass rounded-2xl p-4">
            <Input value={n.title} onChange={(e) => update(n.id, { title: e.target.value })} className="mb-2 border-none bg-transparent px-0 text-base font-semibold focus-visible:ring-0" />
            <Textarea value={n.body} onChange={(e) => update(n.id, { body: e.target.value })} rows={5} className="border-none bg-transparent px-0 focus-visible:ring-0" />
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{new Date(n.updated).toLocaleString()}</span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => { update(n.id, {}); toast("Saved"); }}><Save className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(n.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
