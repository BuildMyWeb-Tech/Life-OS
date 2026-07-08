ALTER TABLE public.lifeos_work_nodes
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS due_time time;