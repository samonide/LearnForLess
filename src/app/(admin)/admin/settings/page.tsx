import { ShieldCheck, Database, HardDrive, Palette } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getSiteSettings } from "@/lib/site-settings";
import SiteSettingsForm from "./site-settings-form";

export default async function AdminSettingsPage() {
  const settings = await getSiteSettings();

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Settings
          </h1>
          <p className="text-muted-foreground">
            Portal configuration, storage properties, and security rules.
          </p>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Site Settings */}
        <section className="border border-border bg-card rounded-xl md:col-span-2">
          <header className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <Palette className="w-4 h-4 text-primary" />
                Site Branding
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Name, tagline, logo, footer, and support contact shown to students.
              </p>
            </div>
          </header>
          <SiteSettingsForm initial={settings} />
        </section>

        {/* Core Config */}
        <section className="border border-border bg-card rounded-xl">
          <header className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <Database className="w-4 h-4 text-primary" />
                General Configuration
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Basic portal credentials and client configuration.
              </p>
            </div>
          </header>
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-foreground block">Production Base URL</span>
              <span className="text-sm text-muted-foreground block bg-muted/30 px-3 py-2 rounded border border-border font-mono">
                {process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}
              </span>
            </div>
          </div>
        </section>

        {/* Storage Metrics Info */}
        <section className="border border-border bg-card rounded-xl">
          <header className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <HardDrive className="w-4 h-4 text-primary" />
              Media Storage Bucket
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Check private file storage bucket properties.
            </p>
          </header>
          <div className="p-5 space-y-4">
            <div className="space-y-1 bg-muted/10 p-3 rounded border border-border">
              <div className="flex justify-between items-center text-xs pb-1.5 border-b border-border mb-1.5">
                <span className="font-semibold">Bucket ID</span>
                <span className="font-mono text-primary font-semibold">course-materials</span>
              </div>
              <div className="flex justify-between items-center text-xs pb-1.5 border-b border-border mb-1.5">
                <span className="font-semibold">Privacy Level</span>
                <Badge variant="secondary" className="text-[10px]">Private (RLS Secured)</Badge>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold">Maximum File Upload Size</span>
                <span className="font-semibold">500 Megabytes</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              * Files uploaded inside lesson components automatically inherit RLS policies restricting downloads to authorized students only.
            </p>
          </div>
        </section>

        {/* Security Guidelines */}
        <section className="border border-border bg-card rounded-xl md:col-span-2">
          <header className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Access Security Audit Constraints
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              LearnForLess security principles mapping access tokens to DB records.
            </p>
          </header>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs text-muted-foreground leading-relaxed">
            <div className="space-y-2 border border-border p-4 rounded-lg">
              <span className="font-semibold text-foreground block text-sm">Token Hashing</span>
              <p>
                Plaintext access token strings are NEVER written to the database. They are generated on-the-fly and hashed using cryptographically secure SHA-256 algorithms before persistence.
              </p>
            </div>
            <div className="space-y-2 border border-border p-4 rounded-lg">
              <span className="font-semibold text-foreground block text-sm">Privileged Actions</span>
              <p>
                All course registrations and manual grant actions are logged automatically into audit logs. Privileged actions bypass Row Level Security only through validated server actions.
              </p>
            </div>
            <div className="space-y-2 border border-border p-4 rounded-lg">
              <span className="font-semibold text-foreground block text-sm">Row Level Security</span>
              <p>
                Supabase Row Level Security (RLS) is enabled on all PostgreSQL tables. Students only have access to modules, lessons, and assets mapping to valid user courses.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
