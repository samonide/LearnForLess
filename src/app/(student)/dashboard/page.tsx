import Link from "next/link";
import { getStudentCourses, getNextUnfinishedLesson } from "@/actions/student/courses";
import { Button } from "@/components/ui/button";
import TokenRedeemForm from "@/components/TokenRedeemForm";
import { ArrowRight, BookOpen, Play, CheckCircle2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface CourseItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnail_url: string | null;
  status: string;
  sort_order: number;
  completed_lessons: number;
  total_lessons: number;
  progress_pct: number;
  module_count: number;
  expires_at: string | null;
}

function groupCourses(courses: CourseItem[]) {
  const inProgress: CourseItem[] = [];
  const completed: CourseItem[] = [];
  const notStarted: CourseItem[] = [];

  for (const course of courses) {
    if (course.progress_pct >= 100) {
      completed.push(course);
    } else if (course.progress_pct > 0) {
      inProgress.push(course);
    } else {
      notStarted.push(course);
    }
  }

  return { inProgress, completed, notStarted };
}

/* ──────────────────────
   Course card — compact
   visual card with
   prominent thumbnail
   ────────────────────── */
function CourseCard({ course, href }: { course: CourseItem; href: string }) {
  return (
    <Link href={href} className="block group">
      <div className="bg-card border border-border rounded-xl overflow-hidden transition group-hover:border-muted-foreground/30">
        <div className="aspect-[5/3] bg-muted overflow-hidden">
          {course.thumbnail_url ? (
            <img
              src={course.thumbnail_url}
              alt=""
              className="w-full h-full object-cover transition duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-muted-foreground/40" />
            </div>
          )}
        </div>
        <div className="p-4 md:p-5 space-y-2.5">
          <h3 className="text-base font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">
            {course.title}
          </h3>
          {course.description && (
            <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2">
              {course.description}
            </p>
          )}
          <div className="flex items-center justify-between pt-0.5">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="tabular-nums">{course.module_count} module{course.module_count !== 1 ? "s" : ""}</span>
              <span className="tabular-nums">{course.total_lessons} lesson{course.total_lessons !== 1 ? "s" : ""}</span>
            </div>
            {course.progress_pct > 0 && (
              <span className="text-xs tabular-nums text-primary font-medium">{course.progress_pct}%</span>
            )}
          </div>
          {course.progress_pct > 0 && (
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${course.progress_pct}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ──────────────────────
   Featured in-progress
   — larger hero card
   ────────────────────── */
function FeaturedCard({ course, href }: { course: CourseItem; href: string }) {
  return (
    <Link href={href} className="block group">
      <div className="bg-card border border-border rounded-xl overflow-hidden transition group-hover:border-muted-foreground/30">
        <div className="aspect-[5/3] md:aspect-[8/3] bg-muted overflow-hidden">
          {course.thumbnail_url ? (
            <img
              src={course.thumbnail_url}
              alt=""
              className="w-full h-full object-cover transition duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="w-10 h-10 text-muted-foreground/40" />
            </div>
          )}
        </div>
        <div className="p-5 md:p-7 space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">
            {course.title}
          </h2>
          {course.description && (
            <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2">
              {course.description}
            </p>
          )}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="tabular-nums">{course.module_count} module{course.module_count !== 1 ? "s" : ""}</span>
              <span className="tabular-nums">{course.total_lessons} lesson{course.total_lessons !== 1 ? "s" : ""}</span>
              <span className="tabular-nums text-primary font-medium">{course.completed_lessons} completed</span>
            </div>
            <Button size="sm" className="shrink-0">
              Continue
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${course.progress_pct}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-foreground tabular-nums min-w-[3ch] text-right">
              {course.progress_pct}%
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default async function DashboardPage() {
  const coursesResult = await getStudentCourses();

  // ── Error state ──
  if (!coursesResult.success) {
    return (
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="max-w-lg">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground text-balance">
            Your Courses
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            We couldn&rsquo;t load your courses right now.
          </p>
          <p className="text-destructive text-sm mt-4">
            {coursesResult.error}
          </p>
        </div>
      </main>
    );
  }

  const courses = (coursesResult.data || []) as CourseItem[];
  const { inProgress, completed, notStarted } = groupCourses(courses);

  // ── Stats ──
  const totalLessons = courses.reduce((sum, c) => sum + c.total_lessons, 0);
  const completedLessons = courses.reduce((sum, c) => sum + c.completed_lessons, 0);
  const overallPct = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);

  // ── Pre-compute hrefs ──
  const courseHrefs = new Map<string, string>();
  for (const course of [...inProgress, ...notStarted]) {
    const { lessonId } = await getNextUnfinishedLesson(course.id);
    courseHrefs.set(
      course.id,
      lessonId
        ? `/course/${course.id}/lesson/${lessonId}`
        : `/course/${course.id}`
    );
  }
  for (const course of completed) {
    courseHrefs.set(course.id, `/course/${course.id}`);
  }

  return (
    <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      {/* ── Header ── */}
      <div className="mb-8 md:mb-10">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground text-balance leading-[1.1]">
          Your Courses
        </h1>
        <p className="text-muted-foreground text-sm mt-2">
          {courses.length} course{courses.length !== 1 ? "s" : ""} &middot; {overallPct}% overall
          {inProgress.length > 0 && ` · ${inProgress.length} in progress`}
        </p>
      </div>

      {/* ── Empty state ── */}
      {courses.length === 0 ? (
        <div className="max-w-lg">
          <p className="text-muted-foreground leading-relaxed mb-6">
            You don&rsquo;t have any courses yet. Enter an access token from your instructor below
            to unlock your first course.
          </p>
          <div className="border-t border-border pt-6">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">
              Redeem access token
            </p>
            <TokenRedeemForm />
          </div>
        </div>
      ) : (
        <div className="space-y-12">
          {/* ── In progress ── */}
          {inProgress.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-5">
                In progress
              </p>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {inProgress.map((course) => (
                  <FeaturedCard
                    key={course.id}
                    course={course}
                    href={courseHrefs.get(course.id)!}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Not started ── */}
          {notStarted.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-5">
                Not started
              </p>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {notStarted.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    href={courseHrefs.get(course.id)!}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Completed ── */}
          {completed.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-5">
                Completed
              </p>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {completed.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    href={courseHrefs.get(course.id)!}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Token redemption ── */}
          <div className="border-t border-border pt-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Redeem another token
            </p>
            <p className="text-muted-foreground text-sm mb-4 max-w-md">
              Enter a new access token to unlock additional courses.
            </p>
            <div className="max-w-sm">
              <TokenRedeemForm />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}