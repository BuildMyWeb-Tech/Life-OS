import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type RoutineItem = {
  id: string;
  title: string;
  time: string | null;
  notes: string | null;
  sort_order: number;
  held: boolean;
};

export type RoutineLog = {
  id: string;
  item_id: string;
  log_date: string;
  done: boolean;
};

const QK = {
  items: ["lifeos", "routine-items"] as const,
  logs: (from: string, to: string) => ["lifeos", "routine-logs", from, to] as const,
};

export function useRoutineItems() {
  return useQuery({
    queryKey: QK.items,
    queryFn: async (): Promise<RoutineItem[]> => {
      const { data, error } = await supabase
        .from("lifeos_routine_items")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as RoutineItem[];
    },
  });
}

export function useRoutineLogs(from: string, to: string) {
  return useQuery({
    queryKey: QK.logs(from, to),
    queryFn: async (): Promise<RoutineLog[]> => {
      const { data, error } = await supabase
        .from("lifeos_routine_logs")
        .select("*")
        .gte("log_date", from)
        .lte("log_date", to);
      if (error) throw error;
      return (data ?? []) as RoutineLog[];
    },
  });
}

export function useCreateRoutineItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      time?: string | null;
      notes?: string | null;
      sort_order?: number;
    }) => {
      const { error } = await supabase.from("lifeos_routine_items").insert(input);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.items }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateRoutineItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<RoutineItem>) => {
      const { error } = await supabase
        .from("lifeos_routine_items")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(patch as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.items }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteRoutineItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lifeos_routine_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.items });
      qc.invalidateQueries({ queryKey: ["lifeos", "routine-logs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReorderRoutineItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ordered: { id: string; sort_order: number }[]) => {
      // run updates sequentially to keep it simple
      for (const r of ordered) {
        const { error } = await supabase
          .from("lifeos_routine_items")
          .update({ sort_order: r.sort_order })
          .eq("id", r.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.items }),
  });
}

export function useToggleRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      item_id,
      log_date,
      done,
    }: {
      item_id: string;
      log_date: string;
      done: boolean;
    }) => {
      if (done) {
        const { error } = await supabase
          .from("lifeos_routine_logs")
          .upsert({ item_id, log_date, done: true }, { onConflict: "item_id,log_date" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("lifeos_routine_logs")
          .delete()
          .eq("item_id", item_id)
          .eq("log_date", log_date);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lifeos", "routine-logs"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function routineLogIndex(logs: RoutineLog[] | undefined) {
  const s = new Set<string>();
  (logs ?? []).forEach((l) => l.done && s.add(`${l.item_id}|${l.log_date}`));
  return s;
}

export function isRoutineDone(set: Set<string>, itemId: string, date: string) {
  return set.has(`${itemId}|${date}`);
}