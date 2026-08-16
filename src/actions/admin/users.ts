"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult, GrantAccessInput } from "@/types";

async function getAdminUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") throw new Error("Forbidden");
  return { user, supabase };
}

// ============================================================
// GET USERS
// ============================================================

export async function getUsers(page = 1, pageSize = 20) {
  try {
    await getAdminUser();
    const adminClient = createAdminClient();

    const offset = (page - 1) * pageSize;

    const { data, error, count } = await adminClient
      .from("profiles")
      .select(
        `
        id, email, display_name, role, created_at, updated_at,
        user_courses(
          course_id,
          created_at,
          expires_at,
          courses(id, title, status)
        ),
        student_access(last_seen_at)
      `,
        { count: "exact" }
      )
      .range(offset, offset + pageSize - 1)
      .order("created_at", { ascending: false });

    if (error) return { success: false as const, error: error.message };
    return { success: true as const, data: data ?? [], total: count ?? 0 };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ============================================================
// GRANT COURSE ACCESS
// ============================================================

export async function grantCourseAccess(
  input: GrantAccessInput
): Promise<ActionResult<void>> {
  try {
    const { user } = await getAdminUser();
    const adminClient = createAdminClient();

    const result = await adminClient.rpc("grant_course_access_admin", {
      p_admin_id: user.id,
      p_user_id: input.user_id,
      p_course_id: input.course_id,
      p_expires_at: input.expires_at ?? null,
    });

    if (result.error) return { success: false, error: result.error.message };

    const res = result.data as { success: boolean; error?: string };
    if (!res.success) {
      return { success: false, error: res.error ?? "Failed to grant access" };
    }

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${input.user_id}`);
    return { success: true, data: undefined };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ============================================================
// REVOKE COURSE ACCESS
// ============================================================

export async function revokeCourseAccess(
  userId: string,
  courseId: string
): Promise<ActionResult<void>> {
  try {
    const { user } = await getAdminUser();
    const adminClient = createAdminClient();

    const { data: course } = await adminClient
      .from("courses")
      .select("title")
      .eq("id", courseId)
      .single();

    const { error } = await adminClient
      .from("user_courses")
      .delete()
      .eq("user_id", userId)
      .eq("course_id", courseId);

    if (error) return { success: false, error: error.message };

    await adminClient.from("audit_logs").insert({
      admin_id: user.id,
      action: "course_access_revoked",
      entity_type: "user_courses",
      entity_id: userId,
      metadata: { course_id: courseId, course_title: course?.title },
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
    return { success: true, data: undefined };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ============================================================
// GET USER DETAILS
// ============================================================

export async function getUserDetails(userId: string) {
  try {
    await getAdminUser();
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from("profiles")
      .select(
        `
        id, email, display_name, role, created_at,
        user_courses(
          id, course_id, created_at, expires_at, granted_by_token,
          courses(id, title, slug, status, thumbnail_url)
        ),
        student_access(last_seen_at, token_id),
        lesson_progress(lesson_id, completed, progress_percentage, updated_at)
      `
      )
      .eq("id", userId)
      .single();

    if (error) return { success: false as const, error: error.message };
    return { success: true as const, data };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ============================================================
// GET ADMIN STATS
// ============================================================

export async function getAdminStats() {
  try {
    await getAdminUser();
    const adminClient = createAdminClient();

    const [
      { count: totalCourses },
      { count: publishedCourses },
      { count: totalModules },
      { count: totalLessons },
      { count: activeTokens },
      { count: totalStudents },
    ] = await Promise.all([
      adminClient.from("courses").select("*", { count: "exact", head: true }),
      adminClient.from("courses").select("*", { count: "exact", head: true }).eq("status", "published"),
      adminClient.from("modules").select("*", { count: "exact", head: true }),
      adminClient.from("lessons").select("*", { count: "exact", head: true }),
      adminClient.from("access_tokens").select("*", { count: "exact", head: true }).eq("is_active", true),
      adminClient.from("profiles").select("*", { count: "exact", head: true }).eq("role", "student"),
    ]);

    return {
      success: true as const,
      data: {
        total_courses: totalCourses ?? 0,
        published_courses: publishedCourses ?? 0,
        total_modules: totalModules ?? 0,
        total_lessons: totalLessons ?? 0,
        active_tokens: activeTokens ?? 0,
        total_students: totalStudents ?? 0,
      },
    };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ============================================================
// GET AUDIT LOGS (recent)
// ============================================================

export async function getRecentAuditLogs(limit = 20) {
  try {
    await getAdminUser();
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from("audit_logs")
      .select(
        `
        id, action, entity_type, entity_id, metadata, created_at,
        profiles(email, display_name)
      `
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return { success: false as const, error: error.message };
    return { success: true as const, data: data ?? [] };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
