import { createAdminClient } from "@/lib/supabase/server";
import { ArrowLeft, Key } from "lucide-react";
import Link from "next/link";
import NewTokenForm from "./new-token-form";

export const dynamic = "force-dynamic";

export default async function NewTokenPage() {
  const adminClient = createAdminClient();

  // Fetch courses to display as checkable list options
  const { data: courses, error } = await adminClient
    .from("courses")
    .select("id, title, status")
    .order("title", { ascending: true });

  if (error) {
    return (
      <div className="p-8 text-center text-destructive">
        Error loading course list: {error.message}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Navigation */}
      <div>
        <Link
          href="/admin/tokens"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Tokens
        </Link>
      </div>

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Key className="w-6 h-6 text-primary" />
          Create Student Token Account
        </h1>
        <p className="text-muted-foreground text-sm">
          Each token represents one student account. Set student name, assign courses, and optionally add an expiry date.
        </p>
      </div>

      {/* Form Card */}
      <div className="border border-border bg-card p-6 rounded-xl shadow-sm">
        <NewTokenForm courses={courses ?? []} />
      </div>
    </div>
  );
}
