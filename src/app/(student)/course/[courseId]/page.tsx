import { getCourseForViewer, getNextUnfinishedLesson } from "@/actions/student/courses";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BookOpen, AlertCircle, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

interface CoursePageProps {
  params: Promise<{
    courseId: string;
  }>;
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { courseId } = await params;

  // Verify access and get course structure
  const result = await getCourseForViewer(courseId);

  if (!result.success || !result.data) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="text-center space-y-4 max-w-md border border-border rounded-xl p-8 bg-card shadow-sm">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Access Denied</h2>
          <p className="text-muted-foreground text-sm">
            You do not have permission to access this course or the course does not exist.
          </p>
          <Link href="/dashboard" className="block pt-2">
            <Button variant="outline" className="flex items-center gap-2 mx-auto">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const course = result.data;

  // Find next lesson to redirect to
  const { lessonId } = await getNextUnfinishedLesson(courseId);

  if (lessonId) {
    redirect(`/course/${courseId}/lesson/${lessonId}`);
  }

  // Fallback: If no lessons exist at all in the course, render the modules listing
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-8">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-foreground">{course.title}</h1>
        <p className="text-muted-foreground leading-relaxed">{course.description}</p>
      </div>

      <div className="border border-dashed border-border rounded-xl p-12 text-center bg-card">
        <div className="max-w-md mx-auto space-y-4">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto" />
          <h3 className="font-semibold text-lg">No Lessons Published Yet</h3>
          <p className="text-muted-foreground text-sm">
            This course is in development. Check back later or contact your administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
