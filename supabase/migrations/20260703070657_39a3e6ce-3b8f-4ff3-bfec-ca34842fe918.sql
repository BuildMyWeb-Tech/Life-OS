CREATE TABLE public.lifeos_work_nodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  parent_id UUID REFERENCES public.lifeos_work_nodes(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL DEFAULT 'work',
  title TEXT NOT NULL,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lifeos_work_nodes TO authenticated;
GRANT ALL ON public.lifeos_work_nodes TO service_role;

ALTER TABLE public.lifeos_work_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "work_nodes_select_own" ON public.lifeos_work_nodes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "work_nodes_insert_own" ON public.lifeos_work_nodes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "work_nodes_update_own" ON public.lifeos_work_nodes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "work_nodes_delete_own" ON public.lifeos_work_nodes FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX lifeos_work_nodes_user_parent_idx ON public.lifeos_work_nodes(user_id, parent_id, sort_order);

CREATE TRIGGER lifeos_work_nodes_updated_at
  BEFORE UPDATE ON public.lifeos_work_nodes
  FOR EACH ROW EXECUTE FUNCTION public.lifeos_touch_updated_at();