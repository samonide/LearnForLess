import { createAdminClient } from "@/lib/supabase/server";
import { ArrowLeft, KeyRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import EditTokenForm from "./edit-token-form";

export const dynamic = "force-dynamic";

interface EditTokenPageProps {
  params: Promise<{ tokenId: string }>;
}

export default async function EditTokenPage({ params }: EditTokenPageProps) {
  const { tokenId } = await params;
  const adminClient = createAdminClient();

  const [{ data: token, error: tokenError }, { data: courses, error: coursesError }] = await Promise.all([
    adminClient
      .from("access_tokens")
      .select(
        `
        id, name, description, expires_at,
        token_courses(course_id)
      `
      )
      .eq("id", tokenId)
      .single(),
    adminClient.from("courses").select("id, title, status").order("title", { ascending: true }),
  ]);

  if (tokenError || !token) {
    notFound();
  }

  if (coursesError) {
    return (
      <div className="p-8 text-center text-destructive">
        Error loading course list: {coursesError.message}
      </div>
    );
  }

  const selectedCourseIds = ((token.token_courses as Array<{ course_id: string }> | null) ?? []).map(
    (item) => item.course_id
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/admin/tokens"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Student Tokens
        </Link>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <KeyRound className="w-6 h-6 text-primary" />
          Edit Student Token Account
        </h1>
        <p className="text-muted-foreground text-sm">
          Update student name, assigned courses, and token notes. Course changes update this student account.
        </p>
      </div>

      <div className="border border-border bg-card p-6 rounded-xl shadow-sm">
        <EditTokenForm
          token={{
            id: token.id,
            name: token.name,
            description: token.description,
            expires_at: token.expires_at,
            selectedCourseIds,
          }}
          courses={courses ?? []}
        />
      </div>
    </div>
  );
}
