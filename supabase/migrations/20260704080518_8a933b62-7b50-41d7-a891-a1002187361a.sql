DROP POLICY IF EXISTS work_nodes_select_own ON public.lifeos_work_nodes;
DROP POLICY IF EXISTS work_nodes_insert_own ON public.lifeos_work_nodes;
DROP POLICY IF EXISTS work_nodes_update_own ON public.lifeos_work_nodes;
DROP POLICY IF EXISTS work_nodes_delete_own ON public.lifeos_work_nodes;

CREATE POLICY work_nodes_select_own ON public.lifeos_work_nodes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY work_nodes_insert_own ON public.lifeos_work_nodes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY work_nodes_update_own ON public.lifeos_work_nodes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY work_nodes_delete_own ON public.lifeos_work_nodes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);