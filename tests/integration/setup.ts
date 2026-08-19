import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// Environment check
// ============================================================

export function checkEnvironment(): boolean {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ] as const;
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.warn(
      `[test-env] Missing env vars: ${missing.join(", ")}. Skipping integration tests.`
    );
    return false;
  }
  return true;
}

export const isIntegrationTestEnv = checkEnvironment();

// ============================================================
// Client factories
// ============================================================

/**
 * Service-role client — bypasses RLS entirely.
 * Use for setup/teardown only (creating users, courses, cleanup).
 */
export function getServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Anon-key client authenticated as a specific user.
 * RLS policies apply — use for asserting security behavior.
 */
export async function createAuthedClient(
  email: string,
  password: string
): Promise<SupabaseClient> {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Auth sign-in failed: ${error.message}`);
  return client;
}

// ============================================================
// Test data factories
// ============================================================

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

export interface TestCourse {
  courseId: string;
  moduleId: string;
  lessonId: string;
}

/**
 * Create a test user via the Supabase Admin API.
 * Creates the auth user, then upserts the profile with the desired role.
 */
export async function createTestUser(
  svc: SupabaseClient,
  identifier: string,
  password: string,
  role: "admin" | "student" = "student"
): Promise<TestUser> {
  const email = `test-${identifier}@learnforless.test`;

  const { data: userData, error: createError } = await svc.auth.admin.createUser(
    {
      email,
      password,
      email_confirm: true,
    }
  );
  if (createError) throw new Error(`Create user failed: ${createError.message}`);
  if (!userData.user) throw new Error("Create user returned no user object");

  const userId = userData.user.id;

  // Upsert profile — handles both student and admin roles
  const { error: profileError } = await svc.from("profiles").upsert(
    {
      id: userId,
      email,
      username: `test-${identifier}`,
      role,
    },
    { onConflict: "id" }
  );
  if (profileError)
    throw new Error(`Profile upsert failed: ${profileError.message}`);

  return { id: userId, email, password };
}

/**
 * Seed a minimal course with one module and one lesson.
 */
export async function seedTestCourse(
  svc: SupabaseClient,
  identifier: string
): Promise<TestCourse> {
  const slug = `test-course-${identifier}`;

  const { data: course, error: courseError } = await svc
    .from("courses")
    .insert({ title: `Test Course ${identifier}`, slug, status: "published" })
    .select("id")
    .single();
  if (courseError) throw new Error(`Create course failed: ${courseError.message}`);

  const { data: mod, error: modError } = await svc
    .from("modules")
    .insert({
      course_id: course.id,
      title: `Test Module ${identifier}`,
      sort_order: 1,
    })
    .select("id")
    .single();
  if (modError) throw new Error(`Create module failed: ${modError.message}`);

  const { data: lesson, error: lessonError } = await svc
    .from("lessons")
    .insert({
      module_id: mod.id,
      title: `Test Lesson ${identifier}`,
      content_type: "text",
      content: "Test content",
      sort_order: 1,
    })
    .select("id")
    .single();
  if (lessonError) throw new Error(`Create lesson failed: ${lessonError.message}`);

  return { courseId: course.id, moduleId: mod.id, lessonId: lesson.id };
}

/**
 * Grant a student access to a course.
 */
export async function assignStudentToCourse(
  svc: SupabaseClient,
  userId: string,
  courseId: string
): Promise<void> {
  const { error } = await svc
    .from("user_courses")
    .insert({ user_id: userId, course_id: courseId });
  if (error) throw new Error(`Assign student to course failed: ${error.message}`);
}

/**
 * Revoke a student's access to a course.
 */
export async function revokeStudentCourseAccess(
  svc: SupabaseClient,
  userId: string,
  courseId: string
): Promise<void> {
  const { error } = await svc
    .from("user_courses")
    .delete()
    .eq("user_id", userId)
    .eq("course_id", courseId);
  if (error) throw new Error(`Revoke access failed: ${error.message}`);
}

// ============================================================
// Cleanup
// ============================================================

/**
 * Remove all test data created during the test run.
 * Order matters because of FK constraints.
 */
export async function cleanupTestData(
  svc: SupabaseClient,
  userIds: string[],
  courseIds: string[],
  moduleIds: string[] = [],
  lessonIds: string[] = []
): Promise<void> {
  // Remove lesson progress for test users
  for (const uid of userIds) {
    await svc.from("lesson_progress").delete().eq("user_id", uid);
  }

  // Remove user_course links for test users
  for (const uid of userIds) {
    await svc.from("user_courses").delete().eq("user_id", uid);
  }

  // Remove lesson progress, then lessons, then modules, then courses
  for (const lid of lessonIds) {
    await svc.from("lesson_progress").delete().eq("lesson_id", lid);
    await svc.from("lessons").delete().eq("id", lid);
  }
  for (const mid of moduleIds) {
    await svc.from("lessons").delete().eq("module_id", mid);
    await svc.from("modules").delete().eq("id", mid);
  }
  for (const cid of courseIds) {
    await svc.from("token_courses").delete().eq("course_id", cid);
    await svc.from("user_courses").delete().eq("course_id", cid);
    await svc.from("modules").delete().eq("course_id", cid);
    await svc.from("courses").delete().eq("id", cid);
  }

  // Delete auth users (cascades to profiles via ON DELETE CASCADE)
  for (const uid of userIds) {
    await svc.from("profiles").delete().eq("id", uid);
    await svc.auth.admin.deleteUser(uid);
  }
}