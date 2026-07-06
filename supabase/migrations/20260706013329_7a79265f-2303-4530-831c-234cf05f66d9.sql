CREATE TABLE public.lifeos_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date DATE,
  due_time TIME,
  done BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lifeos_tasks TO authenticated;
GRANT ALL ON public.lifeos_tasks TO service_role;

ALTER TABLE public.lifeos_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select_own" ON public.lifeos_tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tasks_insert_own" ON public.lifeos_tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_update_own" ON public.lifeos_tasks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_delete_own" ON public.lifeos_tasks FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER lifeos_tasks_touch_updated_at
BEFORE UPDATE ON public.lifeos_tasks
FOR EACH ROW EXECUTE FUNCTION public.lifeos_touch_updated_at();

CREATE INDEX lifeos_tasks_user_idx ON public.lifeos_tasks(user_id, done, due_date);