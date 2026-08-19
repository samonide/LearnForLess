import { createAdminClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { PlusCircle, MoreHorizontal, BookOpen, Layers, GraduationCap, Edit, Settings, Trash2, Globe, Archive } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { setCourseStatus, deleteCourse } from "@/actions/admin/courses";
import { toast } from "sonner";
import CourseRowActions from "./course-row-actions";

export const dynamic = "force-dynamic";

export default async function AdminCoursesPage() {
  const adminClient = createAdminClient();

  // Query courses along with their modules, lessons, and students enrolled count
  const { data: courses, error } = await adminClient
    .from("courses")
    .select(`
      id, title, slug, status, thumbnail_url, created_at,
      modules(
        id,
        lessons(id)
      ),
      user_courses(count)
    `)
    .order("sort_order", { ascending: true });

  if (error) {
    return (
      <div className="p-8 text-center text-destructive">
        Error loading courses: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Courses
          </h1>
          <p className="text-muted-foreground">
            Create courses, build modules and lessons, set publication, and see enrollments.
          </p>
        </div>
        <Link href="/admin/courses/new" className="shrink-0">
          <Button className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4" />
            New Course
          </Button>
        </Link>
      </div>

      {/* Courses Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {!courses || courses.length === 0 ? (
          <div className="px-6 py-20 text-center space-y-4">
            <BookOpen className="w-12 h-12 text-muted-foreground/40 mx-auto" />
            <h3 className="font-semibold text-lg">No courses yet</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              Get started by creating your first course, then add modules and lessons.
            </p>
            <Link href="/admin/courses/new" className="inline-block pt-2">
              <Button className="flex items-center gap-2">
                <PlusCircle className="w-4 h-4" />
                New Course
              </Button>
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[76px]"></TableHead>
                <TableHead>Course Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Modules</TableHead>
                <TableHead>Lessons</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Created Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.map((course: any) => {
                // Calculate modules and lessons counts
                const moduleCount = course.modules?.length ?? 0;
                const lessonCount = course.modules?.reduce((acc: number, curr: any) => {
                  return acc + (curr.lessons?.length ?? 0);
                }, 0) ?? 0;

                // Enrollments count
                const enrollmentCount = (course.user_courses as any)?.[0]?.count ?? 0;

                return (
                  <TableRow key={course.id}>
                    <TableCell>
                      <div className="w-12 h-12 rounded-lg bg-muted border border-border overflow-hidden flex items-center justify-center">
                        {course.thumbnail_url ? (
                          <img
                            src={course.thumbnail_url}
                            alt={course.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <BookOpen className="w-6 h-6 text-muted-foreground/40" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      <Link href={`/admin/courses/${course.id}/edit`} className="hover:text-primary transition-colors">
                        {course.title}
                      </Link>
                      <span className="block text-xs font-mono text-muted-foreground mt-0.5">
                        /{course.slug}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          course.status === "published"
                            ? "default"
                            : course.status === "archived"
                            ? "secondary"
                            : "outline"
                        }
                        className="capitalize px-2 py-0.5"
                      >
                        {course.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-muted-foreground tabular-nums">{moduleCount}</TableCell>
                    <TableCell className="font-medium text-muted-foreground tabular-nums">{lessonCount}</TableCell>
                    <TableCell className="font-medium tabular-nums">
                      <div className="flex items-center gap-1">
                        <GraduationCap className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{enrollmentCount}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs tabular-nums">
                      {formatDate(course.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <CourseRowActions courseId={course.id} currentStatus={course.status as any} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
