-- Extend the "Hold" (hide title, keep the row) feature to To-Do tasks and
-- Daily Routine items, same as Work & Projects already has.

ALTER TABLE public.lifeos_tasks
  ADD COLUMN held BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.lifeos_routine_items
  ADD COLUMN held BOOLEAN NOT NULL DEFAULT false;