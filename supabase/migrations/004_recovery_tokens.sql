-- ============================================================
-- Recovery tokens for password reset
-- ============================================================
-- Admin generates a recovery token for a student. The student
-- enters username + recovery token + new password at /recover
-- to reset their Supabase Auth password.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.recovery_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username    TEXT NOT NULL,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recovery_tokens_hash     ON public.recovery_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_recovery_tokens_username ON public.recovery_tokens(username);

ALTER TABLE public.recovery_tokens ENABLE ROW LEVEL SECURITY;

-- Only admins can view recovery tokens directly
CREATE POLICY "recovery_tokens_admin_only" ON public.recovery_tokens
  FOR ALL USING (public.is_admin());