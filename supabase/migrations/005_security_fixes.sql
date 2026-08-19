-- ============================================================
-- Migration 005: Security foundation — RPC auth + RLS fixes
-- Fixes three confirmed authorization issues:
--   1. get_course_progress: enforce auth.uid() guard
--   2. grant_course_access_admin: use auth.uid() not caller-supplied ID
--   3. lesson_progress UPDATE policy: require current course access
-- ============================================================

-- ============================================================
-- Fix 1: get_course_progress
-- Adds auth.uid() guard so students can only request their own
-- progress. Admins may still inspect any student's progress.
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
  -- Guard: only the owning user or an admin may query this progress.
  IF p_user_id <> auth.uid() AND NOT public.is_admin() THEN
    RETURN QUERY SELECT 0::INTEGER, 0::INTEGER, 0::INTEGER;
    RETURN;
  END IF;

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
-- Fix 2: grant_course_access_admin
-- Removes caller-supplied p_admin_id; authorizes via auth.uid().
-- ============================================================

CREATE OR REPLACE FUNCTION public.grant_course_access_admin(
  p_user_id   UUID,
  p_course_id UUID,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  -- Determine the caller's identity and verify admin role.
  v_admin_id := auth.uid();

  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_admin_id AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  INSERT INTO public.user_courses (user_id, course_id, expires_at)
  VALUES (p_user_id, p_course_id, p_expires_at)
  ON CONFLICT (user_id, course_id) DO UPDATE
    SET expires_at = p_expires_at;

  -- Audit log uses the authenticated admin ID.
  INSERT INTO public.audit_logs (admin_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_admin_id,
    'course_access_granted',
    'user_courses',
    p_user_id,
    jsonb_build_object('course_id', p_course_id, 'expires_at', p_expires_at)
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- Fix 3: lesson_progress UPDATE policy
-- Adds student_has_course_access() check matching the INSERT
-- policy, so a student whose course access has been revoked
-- cannot modify progress for that course.
-- ============================================================

DROP POLICY IF EXISTS "lesson_progress_update_own" ON public.lesson_progress;

CREATE POLICY "lesson_progress_update_own" ON public.lesson_progress
  FOR UPDATE USING (
    user_id = auth.uid()
    AND public.student_has_course_access(
      public.get_lesson_course_id(lesson_id)
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND public.student_has_course_access(
      public.get_lesson_course_id(lesson_id)
    )
  );