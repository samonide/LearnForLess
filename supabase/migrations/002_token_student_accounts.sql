-- ============================================================
-- Token-backed student accounts
-- Each token represents exactly one student account.
-- ============================================================

ALTER TABLE public.access_tokens
  ADD COLUMN IF NOT EXISTS bound_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Backfill token ownership from earliest recorded access when possible.
UPDATE public.access_tokens t
SET bound_user_id = sa.user_id
FROM (
  SELECT DISTINCT ON (token_id) token_id, user_id
  FROM public.student_access
  WHERE token_id IS NOT NULL
  ORDER BY token_id, created_at ASC
) sa
WHERE t.id = sa.token_id
  AND t.bound_user_id IS NULL;

-- One token must map to one student access row.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'student_access_token_unique'
  ) THEN
    ALTER TABLE public.student_access
      ADD CONSTRAINT student_access_token_unique UNIQUE (token_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'student_access_user_token_unique'
  ) THEN
    ALTER TABLE public.student_access
      ADD CONSTRAINT student_access_user_token_unique UNIQUE (user_id, token_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.redeem_access_token(
  p_token_hash TEXT,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token public.access_tokens%ROWTYPE;
  v_course_ids UUID[];
  v_course_id UUID;
  v_is_first_claim BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_token
  FROM public.access_tokens
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  IF NOT v_token.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'token_disabled');
  END IF;

  IF v_token.expires_at IS NOT NULL AND v_token.expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'token_expired');
  END IF;

  IF v_token.bound_user_id IS NULL THEN
    v_is_first_claim := TRUE;
    UPDATE public.access_tokens
    SET bound_user_id = p_user_id
    WHERE id = v_token.id;
  ELSIF v_token.bound_user_id <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'token_assigned_to_another_student');
  END IF;

  SELECT ARRAY_AGG(tc.course_id) INTO v_course_ids
  FROM public.token_courses tc
  JOIN public.courses c ON c.id = tc.course_id
  WHERE tc.token_id = v_token.id
    AND c.status = 'published';

  IF v_course_ids IS NULL OR array_length(v_course_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_courses_assigned');
  END IF;

  -- Token name is an admin note, never the student's account name.
  -- Display name is only set on first claim when the user has none.
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (p_user_id, NULL, NULL, 'student')
  ON CONFLICT (id) DO UPDATE
  SET display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
      email = NULL,
      role = 'student';

  INSERT INTO public.student_access (user_id, token_id, last_seen_at)
  VALUES (p_user_id, v_token.id, NOW())
  ON CONFLICT (token_id) DO UPDATE
  SET last_seen_at = NOW();

  DELETE FROM public.user_courses
  WHERE user_id = p_user_id
    AND granted_by_token = v_token.id;

  FOREACH v_course_id IN ARRAY v_course_ids LOOP
    INSERT INTO public.user_courses (user_id, course_id, granted_by_token)
    VALUES (p_user_id, v_course_id, v_token.id)
    ON CONFLICT (user_id, course_id) DO UPDATE
    SET granted_by_token = EXCLUDED.granted_by_token;
  END LOOP;

  IF v_is_first_claim THEN
    UPDATE public.access_tokens
    SET current_uses = current_uses + 1,
        last_used_at = NOW(),
        max_uses = 1
    WHERE id = v_token.id;
  ELSE
    UPDATE public.access_tokens
    SET last_used_at = NOW(),
        max_uses = 1
    WHERE id = v_token.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'token_id', v_token.id,
    'course_ids', to_jsonb(v_course_ids)
  );
END;
$$;
