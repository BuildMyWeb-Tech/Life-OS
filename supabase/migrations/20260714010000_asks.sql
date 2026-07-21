-- "Asks" — simple requests tracker: "Get PDF from Mauli" on a given date/time.
CREATE TABLE public.lifeos_asks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  person_name TEXT,
  notes TEXT,
  due_date DATE,
  due_time TIME,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lifeos_asks TO authenticated;
GRANT ALL ON public.lifeos_asks TO service_role;

ALTER TABLE public.lifeos_asks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asks_select_own" ON public.lifeos_asks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "asks_insert_own" ON public.lifeos_asks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "asks_update_own" ON public.lifeos_asks
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "asks_delete_own" ON public.lifeos_asks
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER lifeos_asks_touch_updated_at
BEFORE UPDATE ON public.lifeos_asks
FOR EACH ROW EXECUTE FUNCTION public.lifeos_touch_updated_at();