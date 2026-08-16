import { createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Hammer } from "lucide-react";
import CourseBuilder from "./course-builder";

export const dynamic = "force-dynamic";

interface BuilderPageProps {
  params: Promise<{
    courseId: string;
  }>;
}

export default async function BuilderPage({ params }: BuilderPageProps) {
  const { courseId } = await params;
  const adminClient = createAdminClient();

  // Fetch course metadata
  const { data: course, error: courseError } = await adminClient
    .from("courses")
    .select("id, title, slug")
    .eq("id", courseId)
    .single();

  if (courseError || !course) {
    notFound();
  }

  // Fetch modules with sorted lessons
  const { data: modules, error: modulesError } = await adminClient
    .from("modules")
    .select(`
      id, title, description, sort_order,
      lessons(id, title, description, content_type, content, storage_path, sort_order, is_preview)
    `)
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true });

  if (modulesError) {
    return (
      <div className="p-8 text-center text-destructive">
        Error loading builder modules: {modulesError.message}
      </div>
    );
  }

  // Format lessons sorting order inside modules
  const formattedModules = (modules ?? []).map((mod) => ({
    ...mod,
    lessons: (mod.lessons ?? []).sort((a, b) => a.sort_order - b.sort_order),
  }));

  return (
    <div className="space-y-6">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <Link
            href="/admin/courses"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Course Registry
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2 pt-1">
            <Hammer className="w-6 h-6 text-primary" />
            Visual Course Builder: {course.title}
          </h1>
          <p className="text-muted-foreground text-xs font-mono">
            ID: {course.id} | /{course.slug}
          </p>
        </div>
      </div>

      {/* Visual Course Builder Component */}
      <CourseBuilder courseId={courseId} initialModules={formattedModules as any} />
    </div>
  );
}
