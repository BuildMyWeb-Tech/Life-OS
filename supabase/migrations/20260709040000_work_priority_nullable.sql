-- Priority becomes truly optional: NULL means "no priority set" (title shows
-- in the default/foreground color). Previously it defaulted to 'medium' for
-- every row, which made it impossible to tell an explicitly-chosen Medium
-- apart from an item nobody ever set a priority on.

ALTER TABLE public.lifeos_work_nodes ALTER COLUMN priority DROP NOT NULL;
ALTER TABLE public.lifeos_work_nodes ALTER COLUMN priority DROP DEFAULT;

-- Optional one-time cleanup: every existing row currently has priority =
-- 'medium' (from the old default), so right after this migration they'll all
-- show with the Medium color. If you'd rather start with a clean slate and
-- re-set priority only on the items you actually care about, run this once:
--
-- UPDATE public.lifeos_work_nodes SET priority = NULL WHERE priority = 'medium';