-- One-time work items now stay visible (in Completed Works) for 24 hours
-- after being marked done, then get auto-removed — instead of vanishing the
-- instant they're checked off.
ALTER TABLE public.lifeos_work_nodes
  ADD COLUMN completed_at TIMESTAMPTZ;