import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ClientLead = {
  id: string;
  name: string;
  group_name: string | null;
  priority: "low" | "medium" | "high" | null;
  notes: string | null;
  due_date: string | null;
  due_time: string | null;
  completed: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const QK = ["lifeos", "client-leads"] as const;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (supabase.from as any)("lifeos_client_leads");

export function useClientLeads() {
  return useQuery({
    queryKey: QK,
    queryFn: async (): Promise<ClientLead[]> => {
      const { data, error } = await table()
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ClientLead[];
    },
  });
}

export function useCreateClientLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      group_name?: string | null;
      priority?: "low" | "medium" | "high" | null;
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
        name: input.name,
        group_name: input.group_name ?? null,
        priority: input.priority ?? null,
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

/** Paste-in bulk add: one name per line, all under the same group. */
export function useBulkCreateClientLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { names: string[]; group_name: string | null; startOrder: number }) => {
      const { data: userData } = await supabase.auth.getUser();
      const user_id = userData.user?.id;
      if (!user_id) throw new Error("Not signed in");
      const rows = input.names.map((name, i) => ({
        user_id,
        name,
        group_name: input.group_name,
        sort_order: input.startOrder + i,
      }));
      const { error } = await table().insert(rows);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: QK });
      toast.success(`${vars.names.length} lead${vars.names.length === 1 ? "" : "s"} added`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateClientLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      group_name?: string | null;
      priority?: "low" | "medium" | "high" | null;
      notes?: string | null;
      due_date?: string | null;
      due_time?: string | null;
      completed?: boolean;
    }) => {
      const { id, ...patch } = input;
      const { error } = await table().update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteClientLead() {
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