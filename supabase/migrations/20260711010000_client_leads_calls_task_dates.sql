-- To-Do: optional start/end date range (separate from the existing
-- due_date/due_time, which stays tied to reminders).
ALTER TABLE public.lifeos_tasks
  ADD COLUMN start_date DATE,
  ADD COLUMN end_date DATE;

-- Client Acquisition list: leads/prospects with priority + scheduled
-- discussion date/time + completed/uncompleted.
CREATE TABLE public.lifeos_client_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  group_name TEXT,
  priority TEXT CHECK (priority IS NULL OR priority IN ('low', 'medium', 'high')),
  notes TEXT,
  due_date DATE,
  due_time TIME,
  completed BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lifeos_client_leads TO authenticated;
GRANT ALL ON public.lifeos_client_leads TO service_role;

ALTER TABLE public.lifeos_client_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_leads_select_own" ON public.lifeos_client_leads
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "client_leads_insert_own" ON public.lifeos_client_leads
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "client_leads_update_own" ON public.lifeos_client_leads
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "client_leads_delete_own" ON public.lifeos_client_leads
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER lifeos_client_leads_touch_updated_at
BEFORE UPDATE ON public.lifeos_client_leads
FOR EACH ROW EXECUTE FUNCTION public.lifeos_touch_updated_at();

-- Client Call Management: name + phone (tap-to-call) + scheduled date/time.
CREATE TABLE public.lifeos_client_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  notes TEXT,
  due_date DATE,
  due_time TIME,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lifeos_client_calls TO authenticated;
GRANT ALL ON public.lifeos_client_calls TO service_role;

ALTER TABLE public.lifeos_client_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_calls_select_own" ON public.lifeos_client_calls
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "client_calls_insert_own" ON public.lifeos_client_calls
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "client_calls_update_own" ON public.lifeos_client_calls
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "client_calls_delete_own" ON public.lifeos_client_calls
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER lifeos_client_calls_touch_updated_at
BEFORE UPDATE ON public.lifeos_client_calls
FOR EACH ROW EXECUTE FUNCTION public.lifeos_touch_updated_at();