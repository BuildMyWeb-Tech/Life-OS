import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type VisionPoint = {
  id: string;
  text: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type VisionImage = {
  id: string;
  storage_path: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
};

const POINTS_QK = ["lifeos", "vision-points"] as const;
const IMAGES_QK = ["lifeos", "vision-images"] as const;
const BUCKET = "vision-board";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pointsTable = () => (supabase.from as any)("lifeos_vision_points");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const imagesTable = () => (supabase.from as any)("lifeos_vision_images");

export function useVisionPoints() {
  return useQuery({
    queryKey: POINTS_QK,
    queryFn: async (): Promise<VisionPoint[]> => {
      const { data, error } = await pointsTable()
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as VisionPoint[];
    },
  });
}

export function useCreateVisionPoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { text: string; sort_order?: number }) => {
      const { data: userData } = await supabase.auth.getUser();
      const user_id = userData.user?.id;
      if (!user_id) throw new Error("Not signed in");
      const { error } = await pointsTable().insert({
        user_id,
        text: input.text,
        sort_order: input.sort_order ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: POINTS_QK });
      toast.success("Point added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateVisionPoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      const { error } = await pointsTable().update({ text }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: POINTS_QK }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteVisionPoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await pointsTable().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: POINTS_QK }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReorderVisionPoints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ordered: { id: string; sort_order: number }[]) => {
      for (const r of ordered) {
        const { error } = await pointsTable().update({ sort_order: r.sort_order }).eq("id", r.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: POINTS_QK }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useVisionImages() {
  return useQuery({
    queryKey: IMAGES_QK,
    queryFn: async (): Promise<VisionImage[]> => {
      const { data, error } = await imagesTable()
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as VisionImage[];
    },
  });
}

/**
 * Signed URLs for every image in the board. The bucket is private, so this
 * is how images actually get displayed — each URL is valid for an hour and
 * is re-fetched whenever the image list changes.
 */
export function useVisionImageUrls(images: VisionImage[] | undefined) {
  const ids = (images ?? []).map((i) => i.id).join(",");
  return useQuery({
    queryKey: [...IMAGES_QK, "urls", ids],
    queryFn: async (): Promise<Record<string, string>> => {
      if (!images || images.length === 0) return {};
      const entries = await Promise.all(
        images.map(async (img) => {
          const { data, error } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(img.storage_path, 60 * 60);
          if (error || !data) return [img.id, ""] as const;
          return [img.id, data.signedUrl] as const;
        }),
      );
      return Object.fromEntries(entries);
    },
    enabled: !!images && images.length > 0,
  });
}

export function useUploadVisionImages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (files: File[]) => {
      const { data: userData } = await supabase.auth.getUser();
      const user_id = userData.user?.id;
      if (!user_id) throw new Error("Not signed in");

      for (const file of files) {
        const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
        const path = `${user_id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file);
        if (uploadError) throw uploadError;
        const { error: insertError } = await imagesTable().insert({
          user_id,
          storage_path: path,
          sort_order: 0,
        });
        if (insertError) throw insertError;
      }
    },
    onSuccess: (_data, files) => {
      qc.invalidateQueries({ queryKey: IMAGES_QK });
      toast.success(`${files.length} image${files.length === 1 ? "" : "s"} added`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteVisionImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (image: VisionImage) => {
      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove([image.storage_path]);
      if (storageError) throw storageError;
      const { error } = await imagesTable().delete().eq("id", image.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: IMAGES_QK }),
    onError: (e: Error) => toast.error(e.message),
  });
}