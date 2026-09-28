ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS attachment_path TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS attachment_mime_type VARCHAR(127),
  ADD COLUMN IF NOT EXISTS attachment_size BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notes_attachment_metadata_check'
      AND conrelid = 'public.notes'::regclass
  ) THEN
    ALTER TABLE public.notes
      ADD CONSTRAINT notes_attachment_metadata_check
      CHECK (
        (attachment_path IS NULL AND attachment_name IS NULL
          AND attachment_mime_type IS NULL AND attachment_size IS NULL)
        OR
        (attachment_path IS NOT NULL AND attachment_name IS NOT NULL
          AND attachment_mime_type IS NOT NULL
          AND attachment_size IS NOT NULL AND attachment_size >= 0)
      );
  END IF;
END $$;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'student-note-attachments-private',
  'student-note-attachments-private',
  FALSE,
  10485760,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf', 'text/plain', 'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = FALSE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
