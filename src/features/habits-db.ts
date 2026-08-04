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
  archived_at: string | null;
  scheduled_weekdays: number[] | null;
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

export function useHabits(includeArchived = false) {
  return useQuery({
    queryKey: includeArchived ? [...QK.habits, "with-archived"] : QK.habits,
    queryFn: async (): Promise<Habit[]> => {
      let query = supabase.from("lifeos_habits").select("*");
      if (!includeArchived) query = query.eq("archived", false);
      const { data, error } = await query.order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Habit[];
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
          .upsert({ habit_id, log_date, done: true }, { onConflict: "habit_id,log_date" });
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("lifeos_habits").insert(input as any);
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(patch as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.habits });
      qc.invalidateQueries({ queryKey: [...QK.habits, "with-archived"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Permanent delete — CASCADEs to remove all of this habit's log history too.
 * Prefer archiving (useUpdateHabit with archived:true) for routine cleanup;
 * only use this when you genuinely want the history gone. */
export function useDeleteHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lifeos_habits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.habits });
      qc.invalidateQueries({ queryKey: [...QK.habits, "with-archived"] });
      qc.invalidateQueries({ queryKey: ["lifeos", "logs"] });
      toast.success("Deleted permanently");
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
      const { error } = await supabase.from("lifeos_categories").delete().eq("id", id);
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
      const { error } = await supabase.from("lifeos_categories").update(patch).eq("id", id);
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

/** Was this habit "on the books" for the given day? Used by reports so that
 * archiving or adding a habit today never changes what a past month's
 * percentages look like — each day only counts habits that actually existed
 * (and hadn't been archived yet) on that specific day. */
export function isHabitActiveOn(h: Habit, dayKey: string) {
  const createdKey = h.created_at.slice(0, 10);
  if (dayKey < createdKey) return false;
  if (h.archived_at) {
    const archivedKey = h.archived_at.slice(0, 10);
    if (dayKey > archivedKey) return false;
  }
  return true;
}

/** Was this habit actually scheduled to happen on this specific weekday?
 * Daily habits (or anything without a weekly schedule set) apply every day;
 * weekly habits only apply on their chosen weekday(s) — e.g. "Wash dress"
 * only counts on Sundays, so it's neither pending nor missed any other day. */
export function isHabitScheduledOn(h: Habit, dayKey: string) {
  if (h.frequency !== "weekly") return true;
  if (!h.scheduled_weekdays || h.scheduled_weekdays.length === 0) return true;
  const [y, m, d] = dayKey.split("-").map(Number);
  const weekday = new Date(y, m - 1, d).getDay();
  return h.scheduled_weekdays.includes(weekday);
}

/** Combined gate used everywhere a percentage/stat is computed: the habit
 * must both have existed (not archived) AND be scheduled for this day. */
export function isHabitCountedOn(h: Habit, dayKey: string) {
  return isHabitActiveOn(h, dayKey) && isHabitScheduledOn(h, dayKey);
}