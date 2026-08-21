"use client";

import { updateSiteSettings } from "@/actions/admin/site-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check, Globe, Loader2, Save } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

interface SiteSettingsFormProps {
  initial: {
    site_name: string;
    slogan: string;
    logo_url: string;
    footer_text: string;
    support_email: string;
  };
}

export default function SiteSettingsForm({ initial }: SiteSettingsFormProps) {
  const [siteName, setSiteName] = useState(initial.site_name);
  const [slogan, setSlogan] = useState(initial.slogan);
  const [logoUrl, setLogoUrl] = useState(initial.logo_url);
  const [footerText, setFooterText] = useState(initial.footer_text);
  const [supportEmail, setSupportEmail] = useState(initial.support_email);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    startTransition(async () => {
      const res = await updateSiteSettings({
        site_name: siteName,
        slogan,
        logo_url: logoUrl,
        footer_text: footerText,
        support_email: supportEmail,
      });

      if (res.success) {
        toast.success("Site settings saved. Branding updates across the platform.");
      } else {
        toast.error(res.error || "Failed to save site settings.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="site-name" className="text-xs font-semibold">
            Site Name *
          </Label>
          <Input
            id="site-name"
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            maxLength={100}
            placeholder="LearnForLess"
            disabled={isPending}
            required
          />
          <span className="block text-[10px] text-muted-foreground">
            Shown in the header, footer, and browser title across the platform.
          </span>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="slogan" className="text-xs font-semibold">
            Slogan / Tagline
          </Label>
          <Input
            id="slogan"
            value={slogan}
            onChange={(e) => setSlogan(e.target.value)}
            maxLength={200}
            placeholder="Learn more for less"
            disabled={isPending}
          />
          <span className="block text-[10px] text-muted-foreground">
            Optional one-line tagline. Empty means no tagline is shown.
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="logo-url" className="text-xs font-semibold">
          Logo / Branding URL
        </Label>
        <Input
          id="logo-url"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          maxLength={500}
          placeholder="https://example.com/logo.png"
          disabled={isPending}
        />
        <span className="block text-[10px] text-muted-foreground">
          Optional http(s) image URL. When empty, the built-in logo is used.
        </span>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="footer-text" className="text-xs font-semibold">
          Footer Text
        </Label>
        <Textarea
          id="footer-text"
          value={footerText}
          onChange={(e) => setFooterText(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder={`© ${new Date().getFullYear()} LearnForLess. All rights reserved.`}
          disabled={isPending}
        />
        <span className="block text-[10px] text-muted-foreground">
          Shown in the public footer. When empty, a default copyright line is used.
        </span>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="support-email" className="text-xs font-semibold">
          Support Email
        </Label>
        <Input
          id="support-email"
          type="email"
          value={supportEmail}
          onChange={(e) => setSupportEmail(e.target.value)}
          maxLength={200}
          placeholder="support@example.com"
          disabled={isPending}
        />
        <span className="block text-[10px] text-muted-foreground">
          Optional contact address shown in the public footer.
        </span>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 h-10 font-semibold"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Settings
        </Button>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Globe className="w-3.5 h-3.5 text-primary" />
          Changes apply platform-wide immediately.
        </span>
        {!isPending && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-green-600 dark:text-green-500 font-semibold">
            <Check className="w-3.5 h-3.5" />
            Loaded from database
          </span>
        )}
      </div>
    </form>
  );
}
