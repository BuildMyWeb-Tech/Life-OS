import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Ask = {
  id: string;
  title: string;
  person_name: string | null;
  notes: string | null;
  due_date: string | null;
  due_time: string | null;
  completed: boolean;
  held: boolean;
  held_until: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const QK = ["lifeos", "asks"] as const;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (supabase.from as any)("lifeos_asks");

export function useAsks() {
  return useQuery({
    queryKey: QK,
    queryFn: async (): Promise<Ask[]> => {
      const { data, error } = await table()
        .select("*")
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("due_time", { ascending: true, nullsFirst: false })
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Ask[];
    },
  });
}

export function useCreateAsk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      person_name?: string | null;
      notes?: string | null;
      due_date?: string | null;
      due_time?: string | null;
      sort_order?: number;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const user_id = userData.user?.id;
      if (!user_id) throw new Error("Not signed in");
      const { error } = await table().insert({
        user_id,
        title: input.title,
        person_name: input.person_name ?? null,
        notes: input.notes ?? null,
        due_date: input.due_date ?? null,
        due_time: input.due_time ?? null,
        sort_order: input.sort_order ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateAsk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      title?: string;
      person_name?: string | null;
      notes?: string | null;
      due_date?: string | null;
      due_time?: string | null;
      completed?: boolean;
      held?: boolean;
      held_until?: string | null;
    }) => {
      const { id, ...patch } = input;
      const { error } = await table().update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteAsk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await table().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
    onError: (e: Error) => toast.error(e.message),
  });
}