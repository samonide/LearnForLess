import { createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import EditCourseForm from "./edit-course-form";

interface EditCoursePageProps {
  params: Promise<{
    courseId: string;
  }>;
}

export default async function EditCoursePage({ params }: EditCoursePageProps) {
  const { courseId } = await params;
  const adminClient = createAdminClient();

  const { data: course, error } = await adminClient
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();

  if (error || !course) {
    notFound();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/admin/courses"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Courses
        </Link>
      </div>

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-primary" />
          Edit Course Metadata
        </h1>
        <p className="text-muted-foreground text-sm">
          Update the course title, slug path, description, and status.
        </p>
      </div>

      {/* Form Card */}
      <div className="border border-border bg-card p-6 rounded-xl shadow-sm">
        <EditCourseForm course={course as any} />
      </div>
    </div>
  );
}
