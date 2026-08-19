// ============================================================
// E2E test helpers — reuses integration test setup pattern
// ============================================================
import {
  isIntegrationTestEnv,
  getServiceClient,
  createTestUser,
  seedTestCourse,
  assignStudentToCourse,
  cleanupTestData,
} from "../integration/setup";
import type { SupabaseClient } from "@supabase/supabase-js";

export { isIntegrationTestEnv, getServiceClient, createTestUser, seedTestCourse, assignStudentToCourse, cleanupTestData };

export interface TestCourse {
  courseId: string;
  moduleId: string;
  lessonId: string;
}

/**
 * Creates a course with multiple modules/lessons for richer E2E flows.
 */
export async function seedMultiLessonCourse(
  svc: SupabaseClient,
  identifier: string,
  lessonCount: number = 2
): Promise<{ courseId: string; moduleId: string; lessonIds: string[] }> {
  const slug = `e2e-course-${identifier}`;

  const { data: course, error: ce } = await svc
    .from("courses")
    .insert({ title: `E2E Course ${identifier}`, slug, status: "published" })
    .select("id")
    .single();
  if (ce) throw new Error(`Create course failed: ${ce.message}`);

  const { data: mod, error: me } = await svc
    .from("modules")
    .insert({ course_id: course.id, title: `E2E Module ${identifier}`, sort_order: 1 })
    .select("id")
    .single();
  if (me) throw new Error(`Create module failed: ${me.message}`);

  const lessonIds: string[] = [];
  for (let i = 1; i <= lessonCount; i++) {
    const { data: lesson, error: le } = await svc
      .from("lessons")
      .insert({
        module_id: mod.id,
        title: `E2E Lesson ${identifier} ${i}`,
        content_type: "text",
        content: `This is E2E test lesson content ${i}.`,
        sort_order: i,
      })
      .select("id")
      .single();
    if (le) throw new Error(`Create lesson ${i} failed: ${le.message}`);
    lessonIds.push(lesson.id);
  }

  return { courseId: course.id, moduleId: mod.id, lessonIds };
}

/**
 * SHA-256 hash a token string (mirrors src/lib/utils.ts:hashToken).
 */
export async function hashToken(rawToken: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(rawToken.toUpperCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Create an access token with a known raw token string (for E2E redemption).
 * Token is NOT bound to any user — redeem flow will bind it.
 */
export async function createTestToken(
  svc: SupabaseClient,
  rawToken: string,
  courseIds: string[],
  createdBy: string,
  name: string = "E2E Test Token"
): Promise<string> {
  const tokenHash = await hashToken(rawToken);

  const { data: token, error: te } = await svc
    .from("access_tokens")
    .insert({
      token_hash: tokenHash,
      token_hint: rawToken.slice(0, 4),
      created_by: createdBy,
      name,
      is_active: true,
      max_uses: 1,
      current_uses: 0,
    })
    .select("id")
    .single();
  if (te) throw new Error(`Create token failed: ${te.message}`);

  const { error: tc } = await svc
    .from("token_courses")
    .insert(courseIds.map((cid) => ({ token_id: token.id, course_id: cid })));
  if (tc) throw new Error(`Link token courses failed: ${tc.message}`);

  return token.id;
}

/**
 * Clean up E2E test data — includes token/student_access cleanup.
 */
export async function cleanupE2EData(
  svc: SupabaseClient,
  userIds: string[],
  courseIds: string[],
  moduleIds: string[] = [],
  lessonIds: string[] = [],
  tokenIds: string[] = []
): Promise<void> {
  for (const tid of tokenIds) {
    await svc.from("student_access").delete().eq("token_id", tid);
    await svc.from("token_courses").delete().eq("token_id", tid);
    await svc.from("access_tokens").delete().eq("id", tid);
  }
  await cleanupTestData(svc, userIds, courseIds, moduleIds, lessonIds);
}