-- ============================================================
-- Migration 003: Username-based student authentication
-- Adds username column to profiles for student login
-- ============================================================

-- Add username column (nullable initially, existing profiles won't have one)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT;

-- Unique constraint on username (allows NULLs for existing profiles)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_username_unique'
  ) THEN
    -- A partial unique index that only applies to non-null usernames
    CREATE UNIQUE INDEX profiles_username_unique
      ON public.profiles (username)
      WHERE username IS NOT NULL;
  END IF;
END $$;

-- Index for username lookups during login
CREATE INDEX IF NOT EXISTS idx_profiles_username
  ON public.profiles (username)
  WHERE username IS NOT NULL;