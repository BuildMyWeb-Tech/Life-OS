import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Category = {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  sort_order: number;
};

export type Habit = {
  id: string;
  category_id: string | null;
  parent_id: string | null;
  name: string;
  description: string | null;
  emoji: string | null;
  kind: "positive" | "negative";
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  target: number | null;
  priority: "low" | "medium" | "high";
  reminder_time: string | null;
  sort_order: number;
  archived: boolean;
  created_at: string;
};

export type HabitLog = {
  id: string;
  habit_id: string;
  log_date: string;
  done: boolean;
  note: string | null;
};

const QK = {
  categories: ["lifeos", "categories"] as const,
  habits: ["lifeos", "habits"] as const,
  logs: (from: string, to: string) => ["lifeos", "logs", from, to] as const,
};

export function useCategories() {
  return useQuery({
    queryKey: QK.categories,
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from("lifeos_categories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });
}

export function useHabits() {
  return useQuery({
    queryKey: QK.habits,
    queryFn: async (): Promise<Habit[]> => {
      const { data, error } = await supabase
        .from("lifeos_habits")
        .select("*")
        .eq("archived", false)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Habit[];
    },
  });
}

export function useHabitLogs(from: string, to: string) {
  return useQuery({
    queryKey: QK.logs(from, to),
    queryFn: async (): Promise<HabitLog[]> => {
      const { data, error } = await supabase
        .from("lifeos_habit_logs")
        .select("*")
        .gte("log_date", from)
        .lte("log_date", to);
      if (error) throw error;
      return (data ?? []) as HabitLog[];
    },
  });
}

export function useToggleHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      habit_id,
      log_date,
      done,
    }: {
      habit_id: string;
      log_date: string;
      done: boolean;
    }) => {
      if (done) {
        const { error } = await supabase
          .from("lifeos_habit_logs")
          .upsert(
            { habit_id, log_date, done: true },
            { onConflict: "habit_id,log_date" },
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("lifeos_habit_logs")
          .delete()
          .eq("habit_id", habit_id)
          .eq("log_date", log_date);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lifeos", "logs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Habit> & { name: string }) => {
      const { error } = await supabase.from("lifeos_habits").insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.habits });
      toast.success("Habit added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<Habit>) => {
      const { error } = await supabase
        .from("lifeos_habits")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.habits }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("lifeos_habits")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.habits });
      qc.invalidateQueries({ queryKey: ["lifeos", "logs"] });
      toast.success("Removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; color: string; icon?: string | null }) => {
      const { error } = await supabase.from("lifeos_categories").insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.categories });
      toast.success("Category added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("lifeos_categories")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.categories });
      qc.invalidateQueries({ queryKey: QK.habits });
      toast.success("Category removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<Category>) => {
      const { error } = await supabase
        .from("lifeos_categories")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.categories }),
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Build a `Set<string>` of "habit_id|date" keys for fast lookup. */
export function logIndex(logs: HabitLog[] | undefined) {
  const s = new Set<string>();
  (logs ?? []).forEach((l) => {
    if (l.done) s.add(`${l.habit_id}|${l.log_date}`);
  });
  return s;
}

export function isDone(set: Set<string>, habitId: string, date: string) {
  return set.has(`${habitId}|${date}`);
}
