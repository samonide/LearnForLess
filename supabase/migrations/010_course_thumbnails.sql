-- ============================================================
-- Migration 010: public course-thumbnails bucket (FoundBugs C3)
--
-- Course thumbnails were uploaded into the PRIVATE `course-materials`
-- bucket and their getPublicUrl() output was stored as
-- courses.thumbnail_url. Anonymous requests to /object/public/... on
-- a private bucket return 403, so every stored thumbnail URL was
-- permanently broken (dashboard cards, admin lists, edit preview).
--
-- Fix: dedicated small PUBLIC bucket for cover images. Public URLs
-- from this bucket load everywhere <img> renders them, need no signed
-- URL refresh, and survive serverless cold starts. Lesson materials
-- stay in the private bucket.
--
-- Apply order: run this whole file once in the Supabase SQL Editor.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-thumbnails',
  'course-thumbnails',
  TRUE,
  10485760, -- 10MB — cover images only; lessons keep using course-materials
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Admins manage thumbnail objects. Uploads happen server-side via the
-- service role (bypasses RLS), so this policy exists for hygiene and
-- any future direct admin operations.
CREATE POLICY "storage_thumbnails_admin_all" ON storage.objects
  FOR ALL
  USING (bucket_id = 'course-thumbnails' AND public.is_admin())
  WITH CHECK (bucket_id = 'course-thumbnails' AND public.is_admin());

-- Explicit API-level read access (public-URL serving works without
-- this; this covers authenticated/anon Storage API queries).
CREATE POLICY "storage_thumbnails_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'course-thumbnails');

-- ============================================================
-- REPAIR — null out permanently-broken legacy thumbnail URLs that
-- pointed at the private bucket. They never rendered anywhere, so
-- clearing them restores the placeholder UI until admins re-upload
-- through the now-working picker.
-- ============================================================

UPDATE public.courses
SET thumbnail_url = NULL
WHERE thumbnail_url LIKE '%/object/public/course-materials/%';

-- NOTE: the orphaned image objects under `thumbnails/` in the private
-- `course-materials` bucket are harmless and left in place. Remove the
-- prefix manually in Dashboard → Storage if you want the space back.
