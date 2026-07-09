import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type WorkNode = {
  id: string;
  user_id: string;
  parent_id: string | null;
  node_type: string;
  title: string;
  notes: string | null;
  sort_order: number;
  done: boolean;
  done_on: string | null;
  task_kind: "recurring" | "one_time";
  priority: "low" | "medium" | "high" | null;
  due_date: string | null;
  due_time: string | null;
  created_at: string;
  updated_at: string;
};

const QK = ["lifeos", "work_nodes"] as const;

export function useWorkNodes() {
  return useQuery({
    queryKey: QK,
    queryFn: async (): Promise<WorkNode[]> => {
      const { data, error } = await supabase
        .from("lifeos_work_nodes")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as WorkNode[];
    },
  });
}

export function useCreateWorkNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      parent_id: string | null;
      title: string;
      notes?: string | null;
      node_type?: string;
      sort_order?: number;
      task_kind?: "recurring" | "one_time";
      priority?: "low" | "medium" | "high" | null;
      due_date?: string | null;
      due_time?: string | null;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const user_id = userData.user?.id;
      if (!user_id) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("lifeos_work_nodes")
        .insert({
          user_id,
          parent_id: input.parent_id,
          title: input.title,
          notes: input.notes ?? null,
          node_type: input.node_type ?? "work",
          sort_order: input.sort_order ?? 0,
          task_kind: input.task_kind ?? "recurring",
          due_date: input.due_date ?? null,
          due_time: input.due_time ?? null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...({ priority: input.priority ?? null } as any),
        })
        .select()
        .single();
      if (error) throw error;
      return data as WorkNode;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateWorkNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      title?: string;
      notes?: string | null;
      done?: boolean;
      done_on?: string | null;
      node_type?: string;
      task_kind?: "recurring" | "one_time";
      priority?: "low" | "medium" | "high" | null;
      due_date?: string | null;
      due_time?: string | null;
    }) => {
      const { id, ...patch } = input;
      const { error } = await supabase
        .from("lifeos_work_nodes")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(patch as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteWorkNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lifeos_work_nodes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReorderWorkNodes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: { id: string; sort_order: number; parent_id: string | null }[]) => {
      for (const r of rows) {
        const { error } = await supabase
          .from("lifeos_work_nodes")
          .update({ sort_order: r.sort_order, parent_id: r.parent_id })
          .eq("id", r.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Bulk-reset: mark a set of nodes back to not-done (used by the "Reset" action). */
export function useResetAllWorkNodes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        const { error } = await supabase
          .from("lifeos_work_nodes")
          .update({ done: false, done_on: null })
          .eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      toast.success("All work reset to pending");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}