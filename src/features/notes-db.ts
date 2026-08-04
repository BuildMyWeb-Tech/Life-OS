import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Note = {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const QK = ["lifeos", "notes"] as const;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (supabase.from as any)("lifeos_notes");

export function useNotes() {
  return useQuery({
    queryKey: QK,
    queryFn: async (): Promise<Note[]> => {
      const { data, error } = await table()
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Note[];
    },
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      category?: string | null;
      description?: string | null;
      sort_order?: number;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const user_id = userData.user?.id;
      if (!user_id) throw new Error("Not signed in");
      const { error } = await table().insert({
        user_id,
        title: input.title,
        category: input.category ?? null,
        description: input.description ?? null,
        sort_order: input.sort_order ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      toast.success("Note added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      title?: string;
      category?: string | null;
      description?: string | null;
    }) => {
      const { id, ...patch } = input;
      const { error } = await table().update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await table().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      toast.success("Note deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}