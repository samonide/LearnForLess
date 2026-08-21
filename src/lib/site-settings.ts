import { createAdminClient } from "@/lib/supabase/server";

export interface SiteSettings {
  site_name: string;
  slogan: string;
  logo_url: string;
  footer_text: string;
  support_email: string;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  site_name: "LearnForLess",
  slogan: "",
  logo_url: "",
  footer_text: "",
  support_email: "",
};

/**
 * Read the single-row site settings, falling back to defaults when the
 * row is missing or any field is empty so branding never breaks.
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("site_settings")
      .select("site_name, slogan, logo_url, footer_text, support_email")
      .eq("id", true)
      .single();

    if (error || !data) {
      return DEFAULT_SITE_SETTINGS;
    }

    return {
      site_name: data.site_name || DEFAULT_SITE_SETTINGS.site_name,
      slogan: data.slogan || DEFAULT_SITE_SETTINGS.slogan,
      logo_url: data.logo_url || DEFAULT_SITE_SETTINGS.logo_url,
      footer_text: data.footer_text || DEFAULT_SITE_SETTINGS.footer_text,
      support_email: data.support_email || DEFAULT_SITE_SETTINGS.support_email,
    };
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
}
