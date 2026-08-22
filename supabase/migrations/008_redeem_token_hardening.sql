-- ============================================================
-- Migration 008: redeem_access_token hardening (C1-A + C1-B)
--
-- Fixes FoundBugs C1:
--   Part A — redemption no longer renames students, nulls emails,
--            or changes roles. The live project still runs the OLD
--            function (pre-acda197) that set display_name to the
--            token name; re-apply this file in the SQL Editor.
--   Part B — RPC now requires an authenticated caller whose JWT
--            subject matches p_user_id. EXECUTE is revoked from
--            anon/public so the endpoint can no longer be probed
--            anonymously or used to bind tokens to arbitrary users.
--
-- The app calls this RPC with the student's own session client
-- (src/actions/student/access.ts), never with the service role.
--
-- Apply order: run this whole file once in the Supabase SQL Editor.
-- The repair queries at the bottom are OPTIONAL and must be reviewed
-- before execution (do not run blindly).
-- ============================================================

CREATE OR REPLACE FUNCTION public.redeem_access_token(
  p_token_hash TEXT,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token public.access_tokens%ROWTYPE;
  v_course_ids UUID[];
  v_course_id UUID;
  v_is_first_claim BOOLEAN := FALSE;
BEGIN
  -- ── Authorization guard (C1-B) ────────────────────────────────
  -- Caller must be authenticated AND may only act on themselves.
  -- auth.uid() IS NULL covers anonymous callers and service-role
  -- JWTs (no `sub` claim); NULL-safe comparison avoids the classic
  -- `x <> NULL → NULL → IF passes` hole.
  IF auth.uid() IS NULL OR p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

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

  -- ── Token binding (one token → one student) ───────────────────
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

  -- ── Profile safety net (C1-A) ────────────────────────────────
  -- Redemption operates on an EXISTING authenticated student; a
  -- profile row already exists via the on_auth_user_created trigger.
  -- This insert only backfills a missing row and NEVER mutates an
  -- existing profile: display_name, email, username, and role are
  -- left exactly as they are.
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (p_user_id, NULL, NULL, 'student')
  ON CONFLICT (id) DO NOTHING;

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

-- ============================================================
-- Lock down execution (C1-B)
-- Default Postgres privileges grant EXECUTE to PUBLIC; revoke it
-- and grant only to authenticated sessions. Signature must match
-- the definition above: redeem_access_token(TEXT, UUID).
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.redeem_access_token(TEXT, UUID)
  FROM anon, public;
GRANT EXECUTE ON FUNCTION public.redeem_access_token(TEXT, UUID)
  TO authenticated;

-- ============================================================
-- OPTIONAL REPAIR — review results before running!
-- Restores display_name for profiles damaged by the old function
-- (display_name was overwritten with the token's admin name).
-- Only touches rows where display_name exactly equals the bound
-- token's name and differs from the login username.
-- ============================================================

-- 0. Verify which build the live DB runs first:
--    SELECT prosrc FROM pg_proc WHERE proname = 'redeem_access_token';
--    If it contains `v_token.name`, you are on the old build.

-- 1. Preview damaged rows:
-- SELECT p.id, p.username, p.display_name AS damaged_name, t.name AS token_name
-- FROM public.profiles p
-- JOIN public.access_tokens t ON t.bound_user_id = p.id
-- WHERE p.display_name = t.name
--   AND p.username IS NOT NULL
--   AND p.display_name IS DISTINCT FROM p.username;

-- 2. Repair (restore display_name from username):
-- UPDATE public.profiles p
-- SET display_name = p.username
-- FROM public.access_tokens t
-- WHERE t.bound_user_id = p.id
--   AND p.display_name = t.name
--   AND p.username IS NOT NULL
--   AND p.display_name IS DISTINCT FROM p.username;

-- NOTE: emails nulled by the old build cannot be restored from the
-- database (the value was destroyed). Login is unaffected because it
-- resolves via profiles.username.
