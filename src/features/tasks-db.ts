import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Task = {
  id: string;
  user_id: string;
  title: string;
  due_date: string | null;
  due_time: string | null;
  done: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const QK = ["lifeos", "tasks"] as const;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (supabase.from as any)("lifeos_tasks");

export function useTasks() {
  return useQuery({
    queryKey: QK,
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await table()
        .select("*")
        .order("done", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("due_time", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; due_date?: string | null; due_time?: string | null }) => {
      const { data: userData } = await supabase.auth.getUser();
      const user_id = userData.user?.id;
      if (!user_id) throw new Error("Not signed in");
      const { error } = await table().insert({
        user_id,
        title: input.title,
        due_date: input.due_date ?? null,
        due_time: input.due_time ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      title?: string;
      due_date?: string | null;
      due_time?: string | null;
      done?: boolean;
    }) => {
      const { id, ...patch } = input;
      const { error } = await table().update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTask() {
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
