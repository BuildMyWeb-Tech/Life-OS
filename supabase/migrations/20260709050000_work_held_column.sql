-- "Hold" state for the Pending Works view now lives on the row itself, so it
-- syncs across every device instead of living in one browser's localStorage.
ALTER TABLE public.lifeos_work_nodes
  ADD COLUMN held BOOLEAN NOT NULL DEFAULT false;