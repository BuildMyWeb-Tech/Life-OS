
-- Daily routine items + per-day completion in DB
CREATE TABLE public.lifeos_routine_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  time text,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lifeos_routine_items TO authenticated;
GRANT ALL ON public.lifeos_routine_items TO service_role;
ALTER TABLE public.lifeos_routine_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "routine items owner select" ON public.lifeos_routine_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "routine items owner insert" ON public.lifeos_routine_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "routine items owner update" ON public.lifeos_routine_items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "routine items owner delete" ON public.lifeos_routine_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.lifeos_routine_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  item_id uuid NOT NULL REFERENCES public.lifeos_routine_items(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  done boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, log_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lifeos_routine_logs TO authenticated;
GRANT ALL ON public.lifeos_routine_logs TO service_role;
ALTER TABLE public.lifeos_routine_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "routine logs owner select" ON public.lifeos_routine_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "routine logs owner insert" ON public.lifeos_routine_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "routine logs owner update" ON public.lifeos_routine_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "routine logs owner delete" ON public.lifeos_routine_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.lifeos_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER lifeos_routine_items_updated
BEFORE UPDATE ON public.lifeos_routine_items
FOR EACH ROW EXECUTE FUNCTION public.lifeos_touch_updated_at();
