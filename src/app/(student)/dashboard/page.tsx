import Link from "next/link";
import { getStudentCourses } from "@/actions/student/courses";
import { getNextUnfinishedLesson } from "@/actions/student/courses";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import TokenRedeemForm from "@/components/TokenRedeemForm";
import { BookOpen, GraduationCap, Calendar, ListChecks, PlayCircle, KeyRound } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const coursesResult = await getStudentCourses();

  if (!coursesResult.success) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-md">
          <GraduationCap className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-lg font-semibold">Error Loading Courses</h2>
          <p className="text-muted-foreground text-sm">
            {coursesResult.error}
          </p>
        </div>
      </div>
    );
  }

  const courses = (coursesResult.data || []) as any[];

  return (
    <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-8">
      {/* Welcome header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Welcome back!
        </h1>
        <p className="text-muted-foreground">
          Track your progress and continue learning where you left off.
        </p>
      </div>

      {/* Course list grid */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2 border-b border-border pb-3">
          <BookOpen className="w-5 h-5 text-primary" />
          Your Courses
        </h2>

        {courses.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-12 text-center bg-card">
            <div className="max-w-md mx-auto space-y-4">
              <GraduationCap className="w-12 h-12 text-muted-foreground mx-auto" />
              <h3 className="font-semibold text-lg">No Courses Available</h3>
              <p className="text-muted-foreground text-sm">
                You don&apos;t have any courses yet. Enter an access token from
                your instructor below to unlock your courses.
              </p>
              <div className="pt-2 max-w-sm mx-auto">
                <TokenRedeemForm />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {await Promise.all(
              courses.map(async (course) => {
                // Fetch the continue lesson ID
                const { lessonId } = await getNextUnfinishedLesson(course.id);
                
                // If there are no lessons or all are done, link to course detail page
                // But normally we'll link to /course/[id]/lesson/[firstId] or /course/[id]
                const continueHref = lessonId
                  ? `/course/${course.id}/lesson/${lessonId}`
                  : `/course/${course.id}`;

                return (
                  <div
                    key={course.id}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    {/* Thumbnail placeholder or image */}
                    <div className="aspect-video w-full bg-slate-100 dark:bg-slate-900 border-b border-border flex items-center justify-center relative overflow-hidden">
                      {course.thumbnail_url ? (
                        <img
                          src={course.thumbnail_url}
                          alt={course.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <BookOpen className="w-12 h-12 text-muted-foreground/40" />
                      )}
                      
                      {/* Optional expiry indicator */}
                      {course.expires_at && (
                        <div className="absolute top-2 right-2 bg-background/90 text-foreground backdrop-blur-sm px-2 py-1 rounded text-xs font-medium flex items-center gap-1.5 border border-border">
                          <Calendar className="w-3 h-3 text-destructive" />
                          <span>Expires: {formatDate(course.expires_at)}</span>
                        </div>
                      )}
                    </div>

                    {/* Card Body */}
                    <div className="flex-1 p-5 space-y-4">
                      <div className="space-y-2">
                        <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors line-clamp-1">
                          {course.title}
                        </h3>
                        <p className="text-muted-foreground text-sm line-clamp-2 min-h-[2.5rem]">
                          {course.description || "No description provided."}
                        </p>
                      </div>

                      {/* Course info badges */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground font-medium">
                        <span className="flex items-center gap-1">
                          <ListChecks className="w-3.5 h-3.5" />
                          {course.module_count} modules
                        </span>
                        <span>•</span>
                        <span>{course.total_lessons} lessons</span>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between text-xs font-semibold text-foreground">
                          <span>Progress</span>
                          <span>{course.progress_pct}%</span>
                        </div>
                        <Progress value={course.progress_pct} className="h-2" />
                      </div>
                    </div>

                    {/* Card Footer Button */}
                    <div className="border-t border-border p-4 bg-muted/20">
                      <Link href={continueHref} className="w-full block">
                        <Button className="w-full flex items-center gap-2 group-hover:bg-primary/95 transition-all">
                          <PlayCircle className="w-4 h-4" />
                          Continue Course
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Token redemption — always visible */}
        <div className="border border-border rounded-xl p-5 bg-card">
          <div className="flex items-center gap-2 mb-3">
            <KeyRound className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Redeem Another Token</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Enter a new access token to unlock additional courses.
          </p>
          <div className="max-w-sm">
            <TokenRedeemForm />
          </div>
        </div>
      </div>
    </main>
  );
}
