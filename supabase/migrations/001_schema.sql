-- ============================================================
-- LearnForLess – Complete Database Schema
-- Run this in your Supabase SQL Editor on a fresh project
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- UTILITY FUNCTIONS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABLE: profiles
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  display_name TEXT,
  role        TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'student')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE: courses
-- ============================================================

CREATE TABLE IF NOT EXISTS public.courses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        TEXT NOT NULL,
  slug         TEXT UNIQUE NOT NULL,
  description  TEXT,
  thumbnail_url TEXT,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE: modules
-- ============================================================

CREATE TABLE IF NOT EXISTS public.modules (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id    UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER modules_updated_at
  BEFORE UPDATE ON public.modules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE: lessons
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lessons (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module_id    UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('pdf', 'video', 'text', 'link', 'image', 'file')),
  content      TEXT,
  storage_path TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_preview   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER lessons_updated_at
  BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE: access_tokens
-- ============================================================

CREATE TABLE IF NOT EXISTS public.access_tokens (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_hash   TEXT UNIQUE NOT NULL,  -- SHA-256 hex hash of raw token; NEVER return to client
  token_hint   TEXT,                  -- First 4 chars of raw token for display, e.g. "SF-7"
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at   TIMESTAMPTZ NULL,
  max_uses     INTEGER NULL,
  current_uses INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER access_tokens_updated_at
  BEFORE UPDATE ON public.access_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE: token_courses
-- ============================================================

CREATE TABLE IF NOT EXISTS public.token_courses (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id  UUID NOT NULL REFERENCES public.access_tokens(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(token_id, course_id)
);

-- ============================================================
-- TABLE: student_access
-- ============================================================

CREATE TABLE IF NOT EXISTS public.student_access (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_id    UUID REFERENCES public.access_tokens(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: user_courses
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_courses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id       UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  granted_by_token UUID REFERENCES public.access_tokens(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NULL,
  UNIQUE(user_id, course_id)
);

-- ============================================================
-- TABLE: lesson_progress
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id           UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  completed           BOOLEAN NOT NULL DEFAULT FALSE,
  progress_percentage INTEGER NOT NULL DEFAULT 0,
  last_position       INTEGER NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

-- ============================================================
-- TABLE: audit_logs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   UUID,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- NOTE: Never store raw tokens, hashes, or secrets in metadata
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_user_courses_user_course   ON public.user_courses(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_token_courses_token_course ON public.token_courses(token_id, course_id);
CREATE INDEX IF NOT EXISTS idx_modules_course_sort        ON public.modules(course_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_lessons_module_sort        ON public.lessons(module_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user       ON public.lesson_progress(user_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_access_tokens_hash         ON public.access_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_courses_slug               ON public.courses(slug);
CREATE INDEX IF NOT EXISTS idx_courses_status             ON public.courses(status);
CREATE INDEX IF NOT EXISTS idx_profiles_role              ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin           ON public.audit_logs(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_access_user        ON public.student_access(user_id);

-- ============================================================
-- ROW LEVEL SECURITY – Enable on all tables
-- ============================================================

ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_tokens   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_courses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_access  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_courses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs      ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTIONS FOR RLS
-- ============================================================

-- Check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if student has access to a course
CREATE OR REPLACE FUNCTION public.student_has_course_access(p_course_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_courses uc
    WHERE uc.user_id = auth.uid()
      AND uc.course_id = p_course_id
      AND (uc.expires_at IS NULL OR uc.expires_at > NOW())
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- RLS POLICIES – profiles
-- ============================================================

-- Users can read their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.is_admin());

-- Users can update their own profile (non-role fields)
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

-- Admins can insert profiles (used in trigger/service role)
CREATE POLICY "profiles_insert_admin" ON public.profiles
  FOR INSERT WITH CHECK (public.is_admin() OR id = auth.uid());

-- Admins can delete profiles
CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE USING (public.is_admin());

-- ============================================================
-- RLS POLICIES – courses
-- ============================================================

-- Students see only published courses they have access to
CREATE POLICY "courses_select_student" ON public.courses
  FOR SELECT USING (
    public.is_admin()
    OR (
      status = 'published'
      AND public.student_has_course_access(id)
    )
  );

-- Only admins can insert/update/delete courses
CREATE POLICY "courses_insert_admin" ON public.courses
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "courses_update_admin" ON public.courses
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "courses_delete_admin" ON public.courses
  FOR DELETE USING (public.is_admin());

-- ============================================================
-- RLS POLICIES – modules
-- ============================================================

CREATE POLICY "modules_select" ON public.modules
  FOR SELECT USING (
    public.is_admin()
    OR public.student_has_course_access(course_id)
  );

CREATE POLICY "modules_insert_admin" ON public.modules
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "modules_update_admin" ON public.modules
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "modules_delete_admin" ON public.modules
  FOR DELETE USING (public.is_admin());

-- ============================================================
-- RLS POLICIES – lessons
-- ============================================================

-- Need a helper to get course_id from lesson
CREATE OR REPLACE FUNCTION public.get_lesson_course_id(p_lesson_id UUID)
RETURNS UUID AS $$
  SELECT m.course_id FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE l.id = p_lesson_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE POLICY "lessons_select" ON public.lessons
  FOR SELECT USING (
    public.is_admin()
    OR is_preview = TRUE
    OR EXISTS (
      SELECT 1 FROM public.modules m
      WHERE m.id = module_id
        AND public.student_has_course_access(m.course_id)
    )
  );

CREATE POLICY "lessons_insert_admin" ON public.lessons
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "lessons_update_admin" ON public.lessons
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "lessons_delete_admin" ON public.lessons
  FOR DELETE USING (public.is_admin());

-- ============================================================
-- RLS POLICIES – access_tokens
-- ============================================================

-- CRITICAL: Students must NEVER see token_hash
-- Admins see all columns EXCEPT token_hash should never be
-- returned via client queries (enforce in server actions)
CREATE POLICY "access_tokens_admin_only" ON public.access_tokens
  FOR ALL USING (public.is_admin());

-- ============================================================
-- RLS POLICIES – token_courses
-- ============================================================

CREATE POLICY "token_courses_admin_only" ON public.token_courses
  FOR ALL USING (public.is_admin());

-- ============================================================
-- RLS POLICIES – student_access
-- ============================================================

CREATE POLICY "student_access_own" ON public.student_access
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "student_access_insert" ON public.student_access
  FOR INSERT WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "student_access_update" ON public.student_access
  FOR UPDATE USING (user_id = auth.uid() OR public.is_admin());

-- ============================================================
-- RLS POLICIES – user_courses
-- ============================================================

CREATE POLICY "user_courses_select" ON public.user_courses
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "user_courses_insert" ON public.user_courses
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "user_courses_delete" ON public.user_courses
  FOR DELETE USING (public.is_admin());

-- ============================================================
-- RLS POLICIES – lesson_progress
-- ============================================================

CREATE POLICY "lesson_progress_select_own" ON public.lesson_progress
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "lesson_progress_insert_own" ON public.lesson_progress
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND public.student_has_course_access(
      public.get_lesson_course_id(lesson_id)
    )
  );

CREATE POLICY "lesson_progress_update_own" ON public.lesson_progress
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- RLS POLICIES – audit_logs
-- ============================================================

CREATE POLICY "audit_logs_admin_only" ON public.audit_logs
  FOR ALL USING (public.is_admin());

-- ============================================================
-- SERVER-SIDE FUNCTION: redeem_access_token
-- Called via RPC from server action (service role bypass RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION public.redeem_access_token(
  p_token_hash TEXT,
  p_user_id    UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token        public.access_tokens%ROWTYPE;
  v_token_id     UUID;
  v_course_ids   UUID[];
  v_course_id    UUID;
  v_already_used BOOLEAN := FALSE;
BEGIN
  -- Find token by hash
  SELECT * INTO v_token
  FROM public.access_tokens
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  -- Check active
  IF NOT v_token.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'token_disabled');
  END IF;

  -- Check expiration
  IF v_token.expires_at IS NOT NULL AND v_token.expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'token_expired');
  END IF;

  -- Check max uses (only if this user hasn't already used it)
  SELECT EXISTS (
    SELECT 1 FROM public.student_access
    WHERE user_id = p_user_id AND token_id = v_token.id
  ) INTO v_already_used;

  IF NOT v_already_used THEN
    IF v_token.max_uses IS NOT NULL AND v_token.current_uses >= v_token.max_uses THEN
      RETURN jsonb_build_object('success', false, 'error', 'token_max_uses_reached');
    END IF;
  END IF;

  -- Get assigned courses
  SELECT ARRAY_AGG(tc.course_id) INTO v_course_ids
  FROM public.token_courses tc
  JOIN public.courses c ON c.id = tc.course_id
  WHERE tc.token_id = v_token.id AND c.status = 'published';

  IF v_course_ids IS NULL OR array_length(v_course_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_courses_assigned');
  END IF;

  -- Ensure profile exists
  INSERT INTO public.profiles (id, email, role)
  VALUES (p_user_id, NULL, 'student')
  ON CONFLICT (id) DO NOTHING;

  -- Upsert student_access
  INSERT INTO public.student_access (user_id, token_id, last_seen_at)
  VALUES (p_user_id, v_token.id, NOW())
  ON CONFLICT DO NOTHING;

  UPDATE public.student_access
  SET last_seen_at = NOW()
  WHERE user_id = p_user_id AND token_id = v_token.id;

  -- Grant course access for each course
  FOREACH v_course_id IN ARRAY v_course_ids LOOP
    INSERT INTO public.user_courses (user_id, course_id, granted_by_token)
    VALUES (p_user_id, v_course_id, v_token.id)
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END LOOP;

  -- Increment usage only if first time this user uses this token
  IF NOT v_already_used THEN
    UPDATE public.access_tokens
    SET current_uses = current_uses + 1,
        last_used_at = NOW()
    WHERE id = v_token.id;
  ELSE
    UPDATE public.access_tokens
    SET last_used_at = NOW()
    WHERE id = v_token.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'token_id', v_token.id,
    'course_ids', to_jsonb(v_course_ids)
  );
END;
$$;

-- ============================================================
-- SERVER-SIDE FUNCTION: get_course_progress
-- Returns completed lesson count and total lesson count
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_course_progress(
  p_user_id   UUID,
  p_course_id UUID
)
RETURNS TABLE (
  completed_lessons INTEGER,
  total_lessons     INTEGER,
  progress_pct      INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total     INTEGER;
  v_completed INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.course_id = p_course_id;

  SELECT COUNT(*) INTO v_completed
  FROM public.lesson_progress lp
  JOIN public.lessons l ON l.id = lp.lesson_id
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.course_id = p_course_id
    AND lp.user_id = p_user_id
    AND lp.completed = TRUE;

  RETURN QUERY SELECT
    v_completed::INTEGER,
    v_total::INTEGER,
    CASE WHEN v_total = 0 THEN 0
         ELSE ROUND((v_completed::NUMERIC / v_total::NUMERIC) * 100)::INTEGER
    END;
END;
$$;

-- ============================================================
-- SERVER-SIDE FUNCTION: grant_course_access_admin
-- Admin grants course access manually
-- ============================================================

CREATE OR REPLACE FUNCTION public.grant_course_access_admin(
  p_admin_id  UUID,
  p_user_id   UUID,
  p_course_id UUID,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_admin_id AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  INSERT INTO public.user_courses (user_id, course_id, expires_at)
  VALUES (p_user_id, p_course_id, p_expires_at)
  ON CONFLICT (user_id, course_id) DO UPDATE
    SET expires_at = p_expires_at;

  -- Audit log
  INSERT INTO public.audit_logs (admin_id, action, entity_type, entity_id, metadata)
  VALUES (
    p_admin_id,
    'course_access_granted',
    'user_courses',
    p_user_id,
    jsonb_build_object('course_id', p_course_id, 'expires_at', p_expires_at)
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- STORAGE BUCKET: course-materials (private)
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-materials',
  'course-materials',
  FALSE,
  524288000, -- 500MB
  ARRAY[
    'application/pdf',
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip', 'application/x-zip-compressed',
    'text/plain'
  ]
) ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
-- Admins can upload/read/delete all files
CREATE POLICY "storage_admin_all" ON storage.objects
  FOR ALL USING (
    bucket_id = 'course-materials' AND public.is_admin()
  );

-- Students can only read files in courses they have access to
-- Path format: course-materials/{course_id}/{module_id}/{lesson_id}/{filename}
CREATE POLICY "storage_student_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'course-materials'
    AND public.student_has_course_access(
      (string_to_array(name, '/'))[1]::UUID
    )
  );

-- ============================================================
-- PROFILE AUTO-CREATE TRIGGER
-- Creates a profile when a new auth user signs up
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', SPLIT_PART(COALESCE(NEW.email, ''), '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
