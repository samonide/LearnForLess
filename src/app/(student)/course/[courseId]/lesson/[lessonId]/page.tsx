import { getCourseForViewer, getLessonContent } from "@/actions/student/courses";
import CourseViewer from "@/components/course-viewer";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

interface LessonPageProps {
  params: Promise<{
    courseId: string;
    lessonId: string;
  }>;
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { courseId, lessonId } = await params;

  // 1. Fetch course details and check user authorization
  const courseResult = await getCourseForViewer(courseId);

  if (!courseResult.success || !courseResult.data) {
    redirect("/dashboard");
  }

  // 2. Fetch selected lesson content details (validated against courseId)
  const lessonResult = await getLessonContent(lessonId, courseId);

  if (!lessonResult.success || !lessonResult.data) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="text-center space-y-4 max-w-md bg-card border border-border rounded-xl p-8">
          <div className="w-12 h-12 rounded-xl bg-destructive/10 border border-border flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Content Unavailable</h2>
          <p className="text-muted-foreground text-sm">
            This lesson is not available, or you do not have permission to view it.
          </p>
          <Link href={`/course/${courseId}`} className="block pt-2">
            <Button variant="outline" className="flex items-center gap-2 mx-auto">
              <ArrowLeft className="w-4 h-4" />
              Back to Course
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <CourseViewer
      course={courseResult.data}
      lesson={lessonResult.data}
      courseId={courseId}
      lessonId={lessonId}
    />
  );
}
