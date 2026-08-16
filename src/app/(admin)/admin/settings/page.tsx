import { Settings, ShieldCheck, Database, HardDrive, HelpCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminSettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="border-b border-border pb-5">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Settings className="w-8 h-8 text-primary" />
            Portal Settings
          </h1>
          <p className="text-muted-foreground">
            Review your portal configuration options, database properties, and administrative security rules.
          </p>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Core Config */}
        <Card className="shadow-sm border border-border">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
              <Database className="w-4 h-4 text-primary" />
              General Configuration
            </CardTitle>
            <CardDescription className="text-xs">
              Basic portal credentials and client configuration.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-foreground block">Platform Branding Name</span>
              <span className="text-sm text-muted-foreground block bg-muted/30 px-3 py-2 rounded border border-border">
                {process.env.NEXT_PUBLIC_APP_NAME || "LearnForLess"}
              </span>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-foreground block">Production Base URL</span>
              <span className="text-sm text-muted-foreground block bg-muted/30 px-3 py-2 rounded border border-border font-mono">
                {process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Storage Metrics Info */}
        <Card className="shadow-sm border border-border">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
              <HardDrive className="w-4 h-4 text-primary" />
              Media Storage Bucket
            </CardTitle>
            <CardDescription className="text-xs">
              Check private file storage bucket properties.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1 bg-muted/10 p-3 rounded border border-border">
              <div className="flex justify-between items-center text-xs pb-1.5 border-b border-border mb-1.5">
                <span className="font-bold">Bucket ID</span>
                <span className="font-mono text-primary font-semibold">course-materials</span>
              </div>
              <div className="flex justify-between items-center text-xs pb-1.5 border-b border-border mb-1.5">
                <span className="font-bold">Privacy Level</span>
                <Badge variant="secondary" className="text-[10px]">Private (RLS Secured)</Badge>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold">Maximum File Upload Size</span>
                <span className="font-semibold">500 Megabytes</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              * Files uploaded inside lesson components automatically inherit RLS policies restricting downloads to authorized students only.
            </p>
          </CardContent>
        </Card>

        {/* Security Guidelines */}
        <Card className="shadow-sm border border-border md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Access Security Audit Constraints
            </CardTitle>
            <CardDescription className="text-xs">
              LearnForLess security principles mapping access tokens to DB records.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs text-muted-foreground leading-relaxed pt-2">
            <div className="space-y-2 border border-border p-4 rounded-lg bg-card shadow-sm">
              <span className="font-bold text-foreground block text-sm">Token Hashing</span>
              <p>
                Plaintext access token strings are NEVER written to the database. They are generated on-the-fly and hashed using cryptographically secure SHA-256 algorithms before persistence.
              </p>
            </div>
            <div className="space-y-2 border border-border p-4 rounded-lg bg-card shadow-sm">
              <span className="font-bold text-foreground block text-sm">Privileged Actions</span>
              <p>
                All course registrations and manual grant actions are logged automatically into audit logs. Privileged actions bypass Row Level Security only through validated server actions.
              </p>
            </div>
            <div className="space-y-2 border border-border p-4 rounded-lg bg-card shadow-sm">
              <span className="font-bold text-foreground block text-sm">Row Level Security</span>
              <p>
                Supabase Row Level Security (RLS) is enabled on all PostgreSQL tables. Students only have access to modules, lessons, and assets mapping to valid user courses.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
