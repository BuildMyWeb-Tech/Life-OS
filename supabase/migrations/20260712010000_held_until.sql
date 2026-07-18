-- Optional "hide until" timestamp: when set, a held item automatically
-- becomes visible again once this time passes (checked client-side; nothing
-- server-side needs to run).
ALTER TABLE public.lifeos_work_nodes
  ADD COLUMN held_until TIMESTAMPTZ;

ALTER TABLE public.lifeos_tasks
  ADD COLUMN held_until TIMESTAMPTZ;