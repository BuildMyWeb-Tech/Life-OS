
-- Add user_id ownership columns
ALTER TABLE public.lifeos_categories ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE public.lifeos_habits ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE public.lifeos_habit_logs ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();

-- Backfill existing rows to a sentinel so they remain accessible only to admin operations
UPDATE public.lifeos_categories SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;
UPDATE public.lifeos_habits SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;
UPDATE public.lifeos_habit_logs SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;

ALTER TABLE public.lifeos_categories ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.lifeos_habits ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.lifeos_habit_logs ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS lifeos_categories_user_id_idx ON public.lifeos_categories(user_id);
CREATE INDEX IF NOT EXISTS lifeos_habits_user_id_idx ON public.lifeos_habits(user_id);
CREATE INDEX IF NOT EXISTS lifeos_habit_logs_user_id_idx ON public.lifeos_habit_logs(user_id);

-- Drop overly-permissive policies
DROP POLICY IF EXISTS "lifeos categories open" ON public.lifeos_categories;
DROP POLICY IF EXISTS "lifeos habits open" ON public.lifeos_habits;
DROP POLICY IF EXISTS "lifeos habit logs open" ON public.lifeos_habit_logs;

-- Owner-only policies scoped to auth.uid()
CREATE POLICY "categories owner select" ON public.lifeos_categories
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "categories owner insert" ON public.lifeos_categories
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories owner update" ON public.lifeos_categories
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories owner delete" ON public.lifeos_categories
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "habits owner select" ON public.lifeos_habits
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "habits owner insert" ON public.lifeos_habits
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "habits owner update" ON public.lifeos_habits
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "habits owner delete" ON public.lifeos_habits
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "habit logs owner select" ON public.lifeos_habit_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "habit logs owner insert" ON public.lifeos_habit_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "habit logs owner update" ON public.lifeos_habit_logs
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "habit logs owner delete" ON public.lifeos_habit_logs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Ensure proper grants (no anon access; authenticated only)
REVOKE ALL ON public.lifeos_categories FROM anon;
REVOKE ALL ON public.lifeos_habits FROM anon;
REVOKE ALL ON public.lifeos_habit_logs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lifeos_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lifeos_habits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lifeos_habit_logs TO authenticated;
GRANT ALL ON public.lifeos_categories TO service_role;
GRANT ALL ON public.lifeos_habits TO service_role;
GRANT ALL ON public.lifeos_habit_logs TO service_role;
