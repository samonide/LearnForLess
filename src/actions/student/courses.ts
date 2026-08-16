"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { CourseViewerData, ModuleWithLessonsAndProgress } from "@/types";

async function getStudentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { user, supabase };
}

// ============================================================
// GET STUDENT COURSES (with progress)
// ============================================================

export async function getStudentCourses() {
  try {
    const { user, supabase } = await getStudentUser();

    // Get courses the student has access to via RLS
    const { data: userCourses, error } = await supabase
      .from("user_courses")
      .select(
        `
        course_id, created_at, expires_at,
        courses(id, title, slug, description, thumbnail_url, status, sort_order)
      `
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return { success: false as const, error: error.message };
    if (!userCourses) return { success: true as const, data: [] };

    // Filter to only published courses
    const publishedCourses = (userCourses ?? []).filter(
      (uc) => ((uc as any).courses as { status?: string } | null)?.status === "published"
    );

    // Fetch progress for each course
    const coursesWithProgress = await Promise.all(
      publishedCourses.map(async (uc) => {
        const course = (uc as any).courses as {
          id?: string; title?: string; slug?: string; description?: string | null;
          thumbnail_url?: string | null; status?: string; sort_order?: number;
        } | null;
        if (!course) return null;

        const { data: progress } = await supabase.rpc("get_course_progress", {
          p_user_id: user.id,
          p_course_id: course.id,
        });

        // Get module and lesson count
        const { count: moduleCount } = await supabase
          .from("modules")
          .select("*", { count: "exact", head: true })
          .eq("course_id", course.id);

        const progressData = progress?.[0] ?? {
          completed_lessons: 0,
          total_lessons: 0,
          progress_pct: 0,
        };

        return {
          ...course,
          completed_lessons: progressData.completed_lessons,
          total_lessons: progressData.total_lessons,
          progress_pct: progressData.progress_pct,
          module_count: moduleCount ?? 0,
          expires_at: uc.expires_at,
        };
      })
    );

    return {
      success: true as const,
      data: coursesWithProgress.filter(Boolean),
    };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ============================================================
// GET COURSE FOR VIEWER (with authorization check)
// ============================================================

export async function getCourseForViewer(courseId: string): Promise<{
  success: boolean;
  data?: CourseViewerData;
  error?: string;
}> {
  try {
    const { user, supabase } = await getStudentUser();

    // Authorization: check user has access via RLS (will fail if no user_courses record)
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("*")
      .eq("id", courseId)
      .eq("status", "published")
      .single();

    if (courseError || !course) {
      return { success: false, error: "Course not found or access denied." };
    }

    // Get modules with lessons
    const { data: modules, error: modulesError } = await supabase
      .from("modules")
      .select(
        `
        id, title, description, sort_order,
        lessons(id, title, description, content_type, is_preview, sort_order)
      `
      )
      .eq("course_id", courseId)
      .order("sort_order", { ascending: true });

    if (modulesError) return { success: false, error: modulesError.message };

    // Get all lesson progress for this student
    const allLessonIds = (modules ?? []).flatMap(
      (m) => ((m.lessons as { id: string }[]) ?? []).map((l) => l.id)
    );

    const { data: progressData } = await supabase
      .from("lesson_progress")
      .select("lesson_id, completed, progress_percentage, last_position")
      .eq("user_id", user.id)
      .in("lesson_id", allLessonIds);

    const progressMap = new Map(
      (progressData ?? []).map((p) => [p.lesson_id, p])
    );

    // Build lesson number across all modules
    let lessonNumber = 0;
    let completedCount = 0;
    let totalCount = 0;

    const modulesWithProgress: ModuleWithLessonsAndProgress[] = (modules ?? []).map(
      (m: any) => {
        const lessons = (
          (m.lessons as Array<{
            id: string; title: string; description: string | null;
            content_type: string; is_preview: boolean; sort_order: number;
            module_id?: string;
          }>) ?? []
        )
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((l) => {
            lessonNumber++;
            totalCount++;
            const progress = progressMap.get(l.id);
            if (progress?.completed) completedCount++;
            return {
              ...l,
              module_id: m.id,
              created_at: "",
              updated_at: "",
              content: null,
              storage_path: null,
              progress: progress ?? null,
              lesson_number: lessonNumber,
            };
          });

        const modCompleted = lessons.filter((l) => l.progress?.completed).length;

        return {
          ...m,
          course_id: courseId,
          created_at: "",
          updated_at: "",
          lessons,
          completed_lessons: modCompleted,
          total_lessons: lessons.length,
        };
      }
    );

    const progressPct =
      totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

    return {
      success: true,
      data: {
        ...course,
        modules: modulesWithProgress,
        total_lessons: totalCount,
        completed_lessons: completedCount,
        progress_pct: progressPct,
      },
    };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ============================================================
// GET LESSON CONTENT (with authorization check)
// ============================================================

export async function getLessonContent(lessonId: string): Promise<{
  success: boolean;
  data?: {
    id: string;
    title: string;
    description: string | null;
    content_type: string;
    content: string | null;
    storage_path: string | null;
    signed_url?: string;
    module_id: string;
    course_id: string;
  };
  error?: string;
}> {
  try {
    const { user, supabase } = await getStudentUser();

    // RLS enforces access — will fail if student doesn't have course access
    const { data: lesson, error } = await supabase
      .from("lessons")
      .select(
        `
        id, title, description, content_type, content, storage_path,
        module_id, modules(course_id, courses(status))
      `
      )
      .eq("id", lessonId)
      .single();

    if (error || !lesson) {
      return { success: false, error: "Lesson not found or access denied." };
    }

    const moduleData = lesson.modules as { course_id?: string; courses?: { status?: string }[] | null } | null;
    const courseId = moduleData?.course_id ?? "";
    const courseStatus = Array.isArray(moduleData?.courses) ? moduleData.courses[0]?.status : null;

    if (courseStatus !== "published") {
      return { success: false, error: "This course is not available." };
    }

    // Generate signed URL for storage-based content
    let signedUrl: string | undefined;
    if (lesson.storage_path) {
      // Use admin client for signed URL generation
      const adminClient = createAdminClient();
      const { data: signedData } = await adminClient.storage
        .from("course-materials")
        .createSignedUrl(lesson.storage_path, 3600); // 1 hour
      signedUrl = signedData?.signedUrl;
    }

    return {
      success: true,
      data: {
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        content_type: lesson.content_type,
        content: lesson.content,
        storage_path: lesson.storage_path,
        signed_url: signedUrl,
        module_id: lesson.module_id,
        course_id: courseId,
      },
    };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ============================================================
// GET NEXT UNFINISHED LESSON
// ============================================================

export async function getNextUnfinishedLesson(
  courseId: string
): Promise<{ lessonId: string | null; moduleId: string | null }> {
  try {
    const { user, supabase } = await getStudentUser();

    const { data: modules } = await supabase
      .from("modules")
      .select(
        `
        id, sort_order,
        lessons(id, sort_order)
      `
      )
      .eq("course_id", courseId)
      .order("sort_order", { ascending: true });

    if (!modules || modules.length === 0) return { lessonId: null, moduleId: null };

    const allLessons = modules
      .sort((a, b) => a.sort_order - b.sort_order)
      .flatMap((m) =>
        ((m.lessons as { id: string; sort_order: number }[]) ?? [])
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((l) => ({ lessonId: l.id, moduleId: m.id }))
      );

    if (allLessons.length === 0) return { lessonId: null, moduleId: null };

    const { data: completedProgress } = await supabase
      .from("lesson_progress")
      .select("lesson_id")
      .eq("user_id", user.id)
      .eq("completed", true);

    const completedIds = new Set(
      ((completedProgress ?? []) as any[]).map((p) => p.lesson_id)
    );

    const nextLesson = allLessons.find((l) => !completedIds.has(l.lessonId));
    return nextLesson ?? allLessons[allLessons.length - 1];
  } catch {
    return { lessonId: null, moduleId: null };
  }
}
