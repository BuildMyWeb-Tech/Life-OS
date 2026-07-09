CREATE TABLE public.lifeos_task_subtasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.lifeos_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lifeos_task_subtasks TO authenticated;
GRANT ALL ON public.lifeos_task_subtasks TO service_role;

ALTER TABLE public.lifeos_task_subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subtasks_select_own" ON public.lifeos_task_subtasks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "subtasks_insert_own" ON public.lifeos_task_subtasks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "subtasks_update_own" ON public.lifeos_task_subtasks
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "subtasks_delete_own" ON public.lifeos_task_subtasks
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX lifeos_task_subtasks_task_idx ON public.lifeos_task_subtasks(task_id, sort_order);