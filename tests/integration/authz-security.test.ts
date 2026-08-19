import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  isIntegrationTestEnv,
  getServiceClient,
  createAuthedClient,
  createTestUser,
  seedTestCourse,
  assignStudentToCourse,
  revokeStudentCourseAccess,
  cleanupTestData,
} from "./setup";

// ============================================================
// Security regression tests for Phase 5 migration 005 fixes
//
// These tests run against the LIVE Supabase instance and verify
// real RLS / SECURITY DEFINER behavior.  No mocks.
//
// Environment requirement:
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY
//   SUPABASE_SERVICE_ROLE_KEY
// ============================================================

// ── Shared test state ──────────────────────────────────────
const svc = getServiceClient();
const ids: { users: string[]; courses: string[]; modules: string[]; lessons: string[] } = {
  users: [],
  courses: [],
  modules: [],
  lessons: [],
};

// ── Lifecycle ──────────────────────────────────────────────

beforeAll(async () => {
  if (!isIntegrationTestEnv) {
    console.log("Skipping integration test setup — env vars not available.");
    return;
  }
  // Ensure we have a clean slate: no leftover data from prior runs.
  // (An empty beforeAll is fine — each test cleans up after itself.)
});

afterAll(async () => {
  if (!isIntegrationTestEnv) return;
  // Final sweep — remove any test rows that weren't cleaned up on error.
  await cleanupTestData(svc, ids.users, ids.courses, ids.modules, ids.lessons);
});

// ── Test 1: get_course_progress isolation ──────────────────

describe("get_course_progress (fix 1: auth.uid() guard)", () => {
  const localIds = { users: <string[]>[], courses: <string[]>[], modules: <string[]>[], lessons: <string[]>[] };

  beforeAll(async () => {
    if (!isIntegrationTestEnv) return;
    // Create student A, student B, and a course with a lesson.
    // Student A gets access.  Student B does not.
    const studentA = await createTestUser(svc, "progress-a", "passA123!", "student");
    const studentB = await createTestUser(svc, "progress-b", "passB123!", "student");
    const admin = await createTestUser(svc, "progress-admin", "passAdmin!", "admin");
    const course = await seedTestCourse(svc, "progress");
    await assignStudentToCourse(svc, studentA.id, course.courseId);

    localIds.users.push(studentA.id, studentB.id, admin.id);
    localIds.courses.push(course.courseId);
    localIds.modules.push(course.moduleId);
    localIds.lessons.push(course.lessonId);
    ids.users.push(...localIds.users);
    ids.courses.push(...localIds.courses);
    ids.modules.push(...localIds.modules);
    ids.lessons.push(...localIds.lessons);
  });

  it("student can see their own progress", async () => {
    if (!isIntegrationTestEnv) return;
    const studentA = localIds.users[0];
    const courseId = localIds.courses[0];
    const aClient = await createAuthedClient(
      `test-progress-a@learnforless.test`,
      "passA123!"
    );

    const { data, error } = await aClient.rpc("get_course_progress", {
      p_user_id: studentA,
      p_course_id: courseId,
    });

    expect(error).toBeNull();
    // Student A has access to the course — should see real numbers.
    // The RPC uses RETURNS TABLE, so PostgREST returns an array.
    expect(data).not.toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data[0].total_lessons).toBeGreaterThanOrEqual(1);
  });

  it("student CANNOT see another student's progress", async () => {
    if (!isIntegrationTestEnv) return;
    const studentA = localIds.users[0];
    const studentB = localIds.users[1];
    const courseId = localIds.courses[0];
    const bClient = await createAuthedClient(
      `test-progress-b@learnforless.test`,
      "passB123!"
    );

    // Student B tries to query Student A's progress.
    const { data, error } = await bClient.rpc("get_course_progress", {
      p_user_id: studentA,
      p_course_id: courseId,
    });

    expect(error).toBeNull();
    // Guard returns (0,0,0) for unauthorized cross-user queries.
    // The RPC uses RETURNS TABLE, so PostgREST returns an array.
    expect(data).not.toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data[0].progress_pct).toBe(0);
    expect(data[0].total_lessons).toBe(0);
    expect(data[0].completed_lessons).toBe(0);
  });

  it("admin CAN see any student's progress", async () => {
    if (!isIntegrationTestEnv) return;
    const studentA = localIds.users[0];
    const courseId = localIds.courses[0];
    // Admin user was created in beforeAll as localIds.users[2]
    const adminClient = await createAuthedClient(
      `test-progress-admin@learnforless.test`,
      "passAdmin!"
    );

    const { data, error } = await adminClient.rpc("get_course_progress", {
      p_user_id: studentA,
      p_course_id: courseId,
    });

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
    // Admin sees real data, not zeros.
    expect(data[0].total_lessons).toBeGreaterThanOrEqual(1);
  });

  afterAll(async () => {
    if (!isIntegrationTestEnv) return;
    await cleanupTestData(svc, localIds.users, localIds.courses, localIds.modules, localIds.lessons);
  });
});

// ── Test 2: grant_course_access_admin authorization ────────

describe("grant_course_access_admin (fix 2: auth.uid() authorization)", () => {
  const localIds = { users: <string[]>[], courses: <string[]>[], modules: <string[]>[], lessons: <string[]>[] };

  beforeAll(async () => {
    if (!isIntegrationTestEnv) return;
    const student = await createTestUser(svc, "grant-student", "passG123!", "student");
    const admin = await createTestUser(svc, "grant-admin", "passG456!", "admin");
    const course = await seedTestCourse(svc, "grant");

    localIds.users.push(student.id, admin.id);
    localIds.courses.push(course.courseId);
    localIds.modules.push(course.moduleId);
    localIds.lessons.push(course.lessonId);
    ids.users.push(...localIds.users);
    ids.courses.push(...localIds.courses);
    ids.modules.push(...localIds.modules);
    ids.lessons.push(...localIds.lessons);
  });

  it("non-admin student CANNOT grant course access", async () => {
    if (!isIntegrationTestEnv) return;
    const student = localIds.users[0];
    const courseId = localIds.courses[0];
    const sClient = await createAuthedClient(
      `test-grant-student@learnforless.test`,
      "passG123!"
    );

    // Student tries to grant course access to another user.
    const { data, error } = await sClient.rpc("grant_course_access_admin", {
      p_user_id: student,
      p_course_id: courseId,
      p_expires_at: null,
    });

    // The RPC returns `{ success: false, error: 'unauthorized' }` — it does NOT
    // throw an error at the RPC level.  The anon-key client can call the RPC,
    // but the SECURITY DEFINER function checks auth.uid() + admin role internally.
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data.success).toBe(false);
    expect(data.error).toBe("unauthorized");
  });

  it("admin CAN grant course access", async () => {
    if (!isIntegrationTestEnv) return;
    const student = localIds.users[0];
    const courseId = localIds.courses[0];
    const aClient = await createAuthedClient(
      `test-grant-admin@learnforless.test`,
      "passG456!"
    );

    const { data, error } = await aClient.rpc("grant_course_access_admin", {
      p_user_id: student,
      p_course_id: courseId,
      p_expires_at: null,
    });

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data.success).toBe(true);
  });

  afterAll(async () => {
    if (!isIntegrationTestEnv) return;
    await cleanupTestData(svc, localIds.users, localIds.courses, localIds.modules, localIds.lessons);
  });
});

// ── Test 3: lesson_progress UPDATE policy — revoked access ─

describe("lesson_progress UPDATE policy (fix 3: course-access check)", () => {
  const localIds = { users: <string[]>[], courses: <string[]>[], modules: <string[]>[], lessons: <string[]>[] };

  beforeAll(async () => {
    if (!isIntegrationTestEnv) return;
    const student = await createTestUser(svc, "revoke-student", "passR123!", "student");
    const course = await seedTestCourse(svc, "revoke");
    await assignStudentToCourse(svc, student.id, course.courseId);

    localIds.users.push(student.id);
    localIds.courses.push(course.courseId);
    localIds.modules.push(course.moduleId);
    localIds.lessons.push(course.lessonId);
    ids.users.push(...localIds.users);
    ids.courses.push(...localIds.courses);
    ids.modules.push(...localIds.modules);
    ids.lessons.push(...localIds.lessons);
  });

  it("student with access CAN insert lesson_progress", async () => {
    if (!isIntegrationTestEnv) return;
    const student = localIds.users[0];
    const lessonId = localIds.lessons[0];
    const sClient = await createAuthedClient(
      `test-revoke-student@learnforless.test`,
      "passR123!"
    );

    const { error } = await sClient.from("lesson_progress").insert({
      user_id: student,
      lesson_id: lessonId,
      completed: true,
    });

    expect(error).toBeNull();
  });

  it("student with revoked access CANNOT update lesson_progress", async () => {
    if (!isIntegrationTestEnv) return;
    const student = localIds.users[0];
    const lessonId = localIds.lessons[0];
    const sClient = await createAuthedClient(
      `test-revoke-student@learnforless.test`,
      "passR123!"
    );

    // Revoke the student's course access via service-role client.
    await revokeStudentCourseAccess(svc, student, localIds.courses[0]);

    // Attempt to update the existing row — RLS should silently reject it.
    // PostgREST's UPDATE with RLS filtering returns zero affected rows
    // (data=null, error=null) when the USING clause filters out the row,
    // rather than throwing a 42501.  This is the correct RLS behavior.
    const { data: upData, error: upError } = await sClient
      .from("lesson_progress")
      .update({ completed: false, progress_percentage: 50 })
      .eq("user_id", student)
      .eq("lesson_id", lessonId);

    expect(upError).toBeNull();
    expect(upData).toBeNull(); // no rows matched by the RLS-filtered query

    // Verify the row was NOT actually updated — service-role client bypasses RLS.
    const { data: currentRow } = await svc
      .from("lesson_progress")
      .select("completed, progress_percentage")
      .eq("user_id", student)
      .eq("lesson_id", lessonId)
      .single();

    expect(currentRow).not.toBeNull();
    expect(currentRow?.completed).toBe(true); // still the original value
    expect(currentRow?.progress_percentage).toBe(0); // unchanged
  });

  afterAll(async () => {
    if (!isIntegrationTestEnv) return;
    await cleanupTestData(svc, localIds.users, localIds.courses, localIds.modules, localIds.lessons);
  });
});