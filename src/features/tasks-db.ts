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

export type Subtask = {
  id: string;
  task_id: string;
  title: string;
  done: boolean;
  sort_order: number;
  created_at: string;
};

const QK = ["lifeos", "tasks"] as const;
const SUBTASK_QK = ["lifeos", "task-subtasks"] as const;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (supabase.from as any)("lifeos_tasks");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const subtaskTable = () => (supabase.from as any)("lifeos_task_subtasks");

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
    mutationFn: async (input: {
      title: string;
      due_date?: string | null;
      due_time?: string | null;
    }) => {
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

/** All subtasks for all of the user's tasks, fetched once and grouped client-side. */
export function useSubtasks() {
  return useQuery({
    queryKey: SUBTASK_QK,
    queryFn: async (): Promise<Subtask[]> => {
      const { data, error } = await subtaskTable()
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Subtask[];
    },
  });
}

/** Group a flat subtask list by task_id for quick lookup. */
export function subtasksByTask(subtasks: Subtask[] | undefined) {
  const m = new Map<string, Subtask[]>();
  (subtasks ?? []).forEach((s) => {
    if (!m.has(s.task_id)) m.set(s.task_id, []);
    m.get(s.task_id)!.push(s);
  });
  return m;
}

export function useCreateSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { task_id: string; title: string; sort_order?: number }) => {
      const { data: userData } = await supabase.auth.getUser();
      const user_id = userData.user?.id;
      if (!user_id) throw new Error("Not signed in");
      const { error } = await subtaskTable().insert({
        user_id,
        task_id: input.task_id,
        title: input.title,
        sort_order: input.sort_order ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SUBTASK_QK }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useToggleSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await subtaskTable().update({ done }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SUBTASK_QK }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await subtaskTable().update({ title }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SUBTASK_QK }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await subtaskTable().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SUBTASK_QK }),
    onError: (e: Error) => toast.error(e.message),
  });
}