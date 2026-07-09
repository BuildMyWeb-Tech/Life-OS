-- Vision Board / Manifestation: text points + uploaded images

CREATE TABLE public.lifeos_vision_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lifeos_vision_points TO authenticated;
GRANT ALL ON public.lifeos_vision_points TO service_role;

ALTER TABLE public.lifeos_vision_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vision_points_select_own" ON public.lifeos_vision_points
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "vision_points_insert_own" ON public.lifeos_vision_points
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "vision_points_update_own" ON public.lifeos_vision_points
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "vision_points_delete_own" ON public.lifeos_vision_points
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER lifeos_vision_points_touch_updated_at
BEFORE UPDATE ON public.lifeos_vision_points
FOR EACH ROW EXECUTE FUNCTION public.lifeos_touch_updated_at();

CREATE TABLE public.lifeos_vision_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lifeos_vision_images TO authenticated;
GRANT ALL ON public.lifeos_vision_images TO service_role;

ALTER TABLE public.lifeos_vision_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vision_images_select_own" ON public.lifeos_vision_images
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "vision_images_insert_own" ON public.lifeos_vision_images
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "vision_images_update_own" ON public.lifeos_vision_images
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "vision_images_delete_own" ON public.lifeos_vision_images
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Private storage bucket for the actual image files. Files are stored under
-- "<user_id>/<filename>" and the policies below restrict each user to their
-- own folder. The app reads images back via short-lived signed URLs.
INSERT INTO storage.buckets (id, name, public)
VALUES ('vision-board', 'vision-board', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "vision_board_storage_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'vision-board' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "vision_board_storage_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vision-board' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "vision_board_storage_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'vision-board' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "vision_board_storage_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'vision-board' AND (storage.foldername(name))[1] = auth.uid()::text);