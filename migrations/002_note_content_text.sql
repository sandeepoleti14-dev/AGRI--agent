BEGIN;

ALTER TABLE public.notes
  ALTER COLUMN content TYPE TEXT
  USING content::TEXT;

COMMIT;
