import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ClientCall = {
  id: string;
  name: string;
  phone: string;
  notes: string | null;
  due_date: string | null;
  due_time: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const QK = ["lifeos", "client-calls"] as const;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (supabase.from as any)("lifeos_client_calls");

export function useClientCalls() {
  return useQuery({
    queryKey: QK,
    queryFn: async (): Promise<ClientCall[]> => {
      const { data, error } = await table()
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ClientCall[];
    },
  });
}

export function useCreateClientCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      phone: string;
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
        phone: input.phone,
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

export function useUpdateClientCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      phone?: string;
      notes?: string | null;
      due_date?: string | null;
      due_time?: string | null;
    }) => {
      const { id, ...patch } = input;
      const { error } = await table().update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteClientCall() {
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