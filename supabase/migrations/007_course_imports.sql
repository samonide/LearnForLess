-- ============================================================
-- Migration 007: DB Course Importer foundation
--
-- Additive-only metadata for imported courses/modules/lessons,
-- plus the import-run bookkeeping table. No existing columns
-- or behavior change; all new columns are nullable.
--
-- Source DB reference: DBTest/apna_videos.db (see DBTest/guide.md)
--   courses.id   -> courses.source_id  (stable TEXT identity, e.g. "prime-2")
--   chapter_num  -> modules.source_chapter_num (string sort key, e.g. "3.")
--   (course_id, chapter_name, title) / (course_id, chapter_name, filename)
--                 -> lessons.source_fingerprint (SHA-256 hex)
--   pdfs.b2_key / code_files.b2_key -> lessons.external_b2_key (permanent S3 key,
--                 NEVER a URL; presign at view time)
--   videos.stream_url / wistia_url  -> lessons.content (primary) + external_wistia_url
--   pdfs.bh_url / code_files.bh_url -> lessons.external_bh_url (fallback share)
-- ============================================================

-- ============================================================
-- courses: stable source identity
-- ============================================================
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS source_id    TEXT;
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS source_type  TEXT;

-- Partial unique index: one source course per (type, id).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'courses_source_unique'
  ) THEN
    CREATE UNIQUE INDEX courses_source_unique
      ON public.courses (source_type, source_id)
      WHERE source_id IS NOT NULL;
  END IF;
END $$;

-- ============================================================
-- modules: source chapter identity + ordering key
-- ============================================================
ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS source_chapter_num TEXT;

CREATE INDEX IF NOT EXISTS idx_modules_source_chapter
  ON public.modules (course_id, source_chapter_num) WHERE source_chapter_num IS NOT NULL;

-- ============================================================
-- lessons: stable material fingerprint + external-source metadata
-- ============================================================
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS source_fingerprint TEXT;

ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS external_source TEXT CHECK (external_source IN ('wistia', 'b2', 'buzzheavier'));

ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS external_key TEXT;      -- b2 object key (permanent) / wistia media id
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS external_bh_url TEXT;   -- backup share link
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS file_size INTEGER;
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS source_stamped BOOLEAN; -- pdfs.stamped: 1 = watermark must be stripped

-- One import adds each unique source material at most once per course.
-- Fingerprint == hash(source_type, chapter_name, per-type unique key).
CREATE UNIQUE INDEX IF NOT EXISTS lessons_source_fingerprint_unique
  ON public.lessons (source_fingerprint)
  WHERE source_fingerprint IS NOT NULL AND external_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lessons_external_source
  ON public.lessons (external_source) WHERE external_source IS NOT NULL;

-- ============================================================
-- course_imports: import-run bookkeeping
-- ============================================================
CREATE TABLE IF NOT EXISTS public.course_imports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id        UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  mode             TEXT NOT NULL CHECK (mode IN ('incremental', 'replacement')),
  source_course_id TEXT NOT NULL,
  source_file_name TEXT,
  source_sha256    TEXT,
  created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  summary          JSONB
);

CREATE INDEX IF NOT EXISTS idx_course_imports_course
  ON public.course_imports (course_id, created_at DESC);

ALTER TABLE public.course_imports ENABLE ROW LEVEL SECURITY;

-- Admins only (matches audit_logs/admin tables pattern).
CREATE POLICY "course_imports_admin_only" ON public.course_imports
  FOR ALL USING (public.is_admin());