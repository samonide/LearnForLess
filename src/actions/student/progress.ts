"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

async function getStudentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { user, supabase };
}

// ============================================================
// UPDATE LESSON PROGRESS
// ============================================================

export async function updateLessonProgress(
  lessonId: string,
  updates: {
    completed?: boolean;
    progress_percentage?: number;
    last_position?: number;
  }
): Promise<ActionResult<void>> {
  try {
    const { user, supabase } = await getStudentUser();

    // Verify user has access to the course containing this lesson
    const { data: lessonData } = (await supabase
      .from("lessons")
      .select("id, module_id, modules(course_id)")
      .eq("id", lessonId)
      .single()) as any;

    if (!lessonData) return { success: false, error: "Lesson not found" };

    const courseId = (lessonData.modules as any)?.course_id;
    if (!courseId) return { success: false, error: "Course not found" };

    // RLS will enforce access — if user has no user_courses record this will fail
    const { error } = await supabase
      .from("lesson_progress")
      .upsert(
        {
          user_id: user.id,
          lesson_id: lessonId,
          ...updates,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "user_id,lesson_id" } as any
      );

    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ============================================================
// MARK LESSON COMPLETE
// ============================================================

export async function markLessonComplete(
  lessonId: string
): Promise<ActionResult<{ courseProgress: number }>> {
  try {
    const { user, supabase } = await getStudentUser();

    const { error } = await supabase
      .from("lesson_progress")
      .upsert(
        {
          user_id: user.id,
          lesson_id: lessonId,
          completed: true,
          progress_percentage: 100,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "user_id,lesson_id" } as any
      );

    if (error) return { success: false, error: error.message };

    // Get updated course progress
    const { data: lessonData } = (await supabase
      .from("lessons")
      .select("module_id, modules(course_id)")
      .eq("id", lessonId)
      .single()) as any;

    const courseId = (lessonData?.modules as any)?.course_id;

    let courseProgress = 0;
    if (courseId) {
      const { data: progress } = await supabase.rpc("get_course_progress" as any, {
        p_user_id: user.id,
        p_course_id: courseId,
      } as any);
      courseProgress = (progress as any)?.[0]?.progress_pct ?? 0;
    }

    return { success: true, data: { courseProgress } };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ============================================================
// GET COURSE PROGRESS
// ============================================================

export async function getCourseProgress(courseId: string): Promise<{
  completed_lessons: number;
  total_lessons: number;
  progress_pct: number;
} | null> {
  try {
    const { user, supabase } = await getStudentUser();

    const { data } = await supabase.rpc("get_course_progress" as any, {
      p_user_id: user.id,
      p_course_id: courseId,
    } as any);

    return (data as any)?.[0] ?? { completed_lessons: 0, total_lessons: 0, progress_pct: 0 };
  } catch {
    return null;
  }
}
