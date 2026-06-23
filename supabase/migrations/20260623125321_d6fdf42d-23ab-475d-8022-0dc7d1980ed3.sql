
-- LifeOS Phase 1 schema. Single-user app (client-side gate); allow anon CRUD on these tables.

CREATE TABLE public.lifeos_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#7c3aed',
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lifeos_categories TO anon, authenticated;
GRANT ALL ON public.lifeos_categories TO service_role;
ALTER TABLE public.lifeos_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lifeos categories open" ON public.lifeos_categories FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.lifeos_habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.lifeos_categories(id) ON DELETE SET NULL,
  parent_id uuid REFERENCES public.lifeos_habits(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  emoji text,
  kind text NOT NULL DEFAULT 'positive' CHECK (kind IN ('positive','negative')),
  frequency text NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily','weekly','monthly','yearly')),
  target int,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  reminder_time text,
  sort_order int NOT NULL DEFAULT 0,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lifeos_habits TO anon, authenticated;
GRANT ALL ON public.lifeos_habits TO service_role;
ALTER TABLE public.lifeos_habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lifeos habits open" ON public.lifeos_habits FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX lifeos_habits_parent_idx ON public.lifeos_habits(parent_id);
CREATE INDEX lifeos_habits_category_idx ON public.lifeos_habits(category_id);

CREATE TABLE public.lifeos_habit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid NOT NULL REFERENCES public.lifeos_habits(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  done boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (habit_id, log_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lifeos_habit_logs TO anon, authenticated;
GRANT ALL ON public.lifeos_habit_logs TO service_role;
ALTER TABLE public.lifeos_habit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lifeos habit logs open" ON public.lifeos_habit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX lifeos_habit_logs_date_idx ON public.lifeos_habit_logs(log_date);
CREATE INDEX lifeos_habit_logs_habit_idx ON public.lifeos_habit_logs(habit_id);

-- Seed default categories + a few habits with sub-habits
WITH cats AS (
  INSERT INTO public.lifeos_categories (name, color, icon, sort_order) VALUES
    ('Morning Routine', '#f59e0b', 'sunrise', 1),
    ('Mid Day Routine', '#06b6d4', 'sun', 2),
    ('Evening Routine', '#f97316', 'sunset', 3),
    ('Night Routine', '#6366f1', 'moon', 4),
    ('Health', '#10b981', 'heart-pulse', 5),
    ('Work', '#0ea5e9', 'briefcase', 6),
    ('Finance', '#84cc16', 'wallet', 7),
    ('Learning', '#a855f7', 'book-open', 8),
    ('Avoid', '#ef4444', 'ban', 9)
  RETURNING id, name
),
morning AS (
  INSERT INTO public.lifeos_habits (category_id, name, emoji, kind, frequency, sort_order)
  SELECT id, 'Morning Routine', '🌅', 'positive', 'daily', 1 FROM cats WHERE name = 'Morning Routine'
  RETURNING id
),
gym_cat AS (SELECT id FROM cats WHERE name = 'Health'),
gym AS (
  INSERT INTO public.lifeos_habits (category_id, name, emoji, kind, frequency, sort_order)
  SELECT id, 'Gym', '🏋️', 'positive', 'daily', 1 FROM gym_cat
  RETURNING id
),
night_cat AS (SELECT id FROM cats WHERE name = 'Night Routine'),
night AS (
  INSERT INTO public.lifeos_habits (category_id, name, emoji, kind, frequency, sort_order)
  SELECT id, 'Sleep Before 10 PM', '🌙', 'positive', 'daily', 1 FROM night_cat
  RETURNING id
),
avoid_cat AS (SELECT id FROM cats WHERE name = 'Avoid')
INSERT INTO public.lifeos_habits (category_id, parent_id, name, emoji, kind, frequency, sort_order)
SELECT (SELECT id FROM cats WHERE name='Morning Routine'), (SELECT id FROM morning), v.name, v.emoji, 'positive', 'daily', v.ord
FROM (VALUES
  ('Brush', '🪥', 1),
  ('Face Wash', '🧼', 2),
  ('Drink Water', '💧', 3),
  ('Manifestation', '✨', 4),
  ('Meditation', '🧘', 5),
  ('Eye Exercise', '👁️', 6)
) v(name, emoji, ord)
UNION ALL
SELECT (SELECT id FROM cats WHERE name='Health'), (SELECT id FROM gym), v.name, v.emoji, 'positive', 'daily', v.ord
FROM (VALUES
  ('Warmup', '🔥', 1),
  ('Cardio', '🏃', 2),
  ('Chest', '💪', 3),
  ('Back', '🦾', 4),
  ('Shoulder', '🏋️', 5),
  ('Arms', '💪', 6),
  ('Legs', '🦵', 7),
  ('Stretching', '🧘', 8)
) v(name, emoji, ord)
UNION ALL
SELECT (SELECT id FROM avoid_cat), NULL, v.name, v.emoji, 'negative', 'daily', v.ord
FROM (VALUES
  ('No Junk Food', '🍔', 1),
  ('No Tea', '🍵', 2),
  ('No Coffee', '☕', 3),
  ('No Smoking', '🚭', 4),
  ('No Social Media Overuse', '📵', 5)
) v(name, emoji, ord);
