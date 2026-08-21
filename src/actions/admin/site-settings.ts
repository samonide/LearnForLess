"use server";

import { getAdminUser } from "@/actions/admin/users";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings";
import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface UpdateSiteSettingsInput {
  site_name: string;
  slogan: string;
  logo_url: string;
  footer_text: string;
  support_email: string;
}

export async function updateSiteSettings(
  input: UpdateSiteSettingsInput
): Promise<{ success: boolean; error?: string; data?: { site_name: string } }> {
  try {
    await getAdminUser();

    const siteName = (input.site_name ?? "").trim() || DEFAULT_SITE_SETTINGS.site_name;
    const slogan = (input.slogan ?? "").trim();
    const logoUrl = (input.logo_url ?? "").trim();
    const footerText = (input.footer_text ?? "").trim();
    const supportEmail = (input.support_email ?? "").trim();

    if (siteName.length > 100) {
      return { success: false, error: "Site name must be 100 characters or fewer." };
    }
    if (slogan.length > 200) {
      return { success: false, error: "Slogan must be 200 characters or fewer." };
    }
    if (logoUrl.length > 500) {
      return { success: false, error: "Logo URL must be 500 characters or fewer." };
    }
    if (footerText.length > 500) {
      return { success: false, error: "Footer text must be 500 characters or fewer." };
    }
    if (supportEmail.length > 200) {
      return { success: false, error: "Support email must be 200 characters or fewer." };
    }
    if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
      return { success: false, error: "Support email is not a valid email address." };
    }
    if (logoUrl && !/^https?:\/\//i.test(logoUrl)) {
      return { success: false, error: "Logo URL must be a valid http(s) URL." };
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("site_settings")
      .update({
        site_name: siteName,
        slogan,
        logo_url: logoUrl,
        footer_text: footerText,
        support_email: supportEmail,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);

    if (error) {
      return { success: false, error: `Failed to save settings: ${error.message}` };
    }

    // Rebuild every layout/page that consumes branding.
    revalidatePath("/", "layout");
    return { success: true, data: { site_name: siteName } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save settings.",
    };
  }
}
