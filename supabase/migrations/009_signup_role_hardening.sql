-- ============================================================
-- Migration 009: signup role hardening (FoundBugs C4)
--
-- handle_new_user() previously trusted raw_user_meta_data->>'role'.
-- The anon key is public, so with "Allow new users to sign up"
-- enabled in the Supabase dashboard, anyone could call
-- signUp({ options: { data: { role: 'admin' } } }) directly and get
-- an admin profile. App-side registration always sends 'student',
-- so hardcoding the role changes nothing for legitimate flows.
--
-- display_name from metadata is kept: it is cosmetic only.
--
-- NOTE (dashboard check, cannot be done via SQL): confirm
-- Authentication → Providers → Email → "Allow new users to sign up"
-- matches intended product behavior. This migration is defense in
-- depth; it does not depend on that setting.
--
-- Apply order: run this whole file once in the Supabase SQL Editor.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', SPLIT_PART(COALESCE(NEW.email, ''), '@', 1)),
    'student'
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger already exists from migration 001; recreated here so this
-- file is self-contained if 001's trigger definition ever drifts.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- OPTIONAL REVIEW — profiles that may have been created as admin
-- via crafted signup metadata. Review before running; legitimate
-- admins must be re-promoted through /admin/admins afterwards.
-- ============================================================

-- List admins alongside whether they have any admin audit activity:
-- SELECT p.id, p.email, p.username, p.created_at
-- FROM public.profiles p
-- WHERE p.role = 'admin'
-- ORDER BY p.created_at;
