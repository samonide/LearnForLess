import { getCourseForViewer } from "@/actions/student/courses";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, BookOpen, ArrowLeft } from "lucide-react";
import { Progress } from "@/components/ui/progress";

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
        <div className="text-center space-y-4 max-w-md bg-card border border-border rounded-xl p-8">
          <div className="w-12 h-12 rounded-xl bg-destructive/10 ring-1 ring-destructive/20 flex items-center justify-center mx-auto">
            <BookOpen className="w-6 h-6 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Access Denied</h2>
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
  const hasModules = course.modules.length > 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-8">
      {/* Back to Dashboard */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      {/* Course Header */}
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground text-balance">
          {course.title}
        </h1>
        {course.description && (
          <p className="text-muted-foreground leading-relaxed max-w-2xl">
            {course.description}
          </p>
        )}
      </div>

      {/* Progress Summary */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {course.completed_lessons} of {course.total_lessons} lessons completed
          </span>
          <span className="font-semibold text-foreground tabular-nums">
            {course.progress_pct}%
          </span>
        </div>
        <Progress value={course.progress_pct} />
      </div>

      {/* Modules & Lessons */}
      {hasModules ? (
        <div className="space-y-6">
          {course.modules.map((mod) => {
            const isModuleComplete = mod.total_lessons > 0 && mod.completed_lessons === mod.total_lessons;

            return (
              <div
                key={mod.id}
                className="bg-card border border-border rounded-xl overflow-hidden"
              >
                {/* Module header */}
                <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4">
                  <div className="space-y-0.5 min-w-0">
                    <h2 className="font-semibold text-foreground truncate">
                      {mod.title}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {mod.completed_lessons} / {mod.total_lessons} lessons
                      {isModuleComplete && " — Complete"}
                    </p>
                  </div>
                  {mod.description && (
                    <p className="text-xs text-muted-foreground hidden sm:block max-w-xs text-right leading-relaxed">
                      {mod.description}
                    </p>
                  )}
                </div>

                {/* Lesson list */}
                {mod.lessons.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {mod.lessons.map((les) => {
                      const isCompleted = les.progress?.completed ?? false;

                      return (
                        <li key={les.id}>
                          <Link
                            href={`/course/${courseId}/lesson/${les.id}`}
                            className="flex items-center gap-3 px-6 py-3.5 hover:bg-muted/50 transition-colors"
                          >
                            <span className="shrink-0">
                              {isCompleted ? (
                                <CheckCircle2 className="w-4 h-4 text-primary" />
                              ) : (
                                <Circle className="w-4 h-4 text-muted-foreground/30" />
                              )}
                            </span>
                            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                              {les.lesson_number}.
                            </span>
                            <span className="text-sm font-medium text-foreground truncate">
                              {les.title}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="px-6 py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      No lessons in this module yet.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty state — no modules */
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-12 h-12 rounded-xl bg-muted border border-border flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">No lessons published yet</h3>
              <p className="text-muted-foreground text-sm">
                This course is still in development. Check back later.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}