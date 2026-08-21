-- ============================================================
-- Site settings — single-row config consumed by branding.
-- Admin-editable from the Settings page.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.site_settings (
  id            BOOLEAN PRIMARY KEY DEFAULT TRUE,
  site_name     TEXT NOT NULL DEFAULT 'LearnForLess',
  slogan        TEXT NOT NULL DEFAULT '',
  logo_url      TEXT NOT NULL DEFAULT '',
  footer_text   TEXT NOT NULL DEFAULT '',
  support_email TEXT NOT NULL DEFAULT '',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT site_settings_singleton CHECK (id)
);

INSERT INTO public.site_settings (id) VALUES (TRUE)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Anyone may read branding values (they are shown on public pages).
CREATE POLICY "site_settings_select_public" ON public.site_settings
  FOR SELECT USING (TRUE);

-- Writes go through the service-role admin client; this policy is a
-- defense-in-depth guard so a regular session can never mutate settings.
CREATE POLICY "site_settings_update_admin" ON public.site_settings
  FOR UPDATE USING (public.is_admin());
