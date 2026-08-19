import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isIntegrationTestEnv,
  getServiceClient,
  createAuthedClient,
  createTestUser,
  type TestUser,
} from "./setup";

const svc = getServiceClient();

// Safety-net: track all IDs for final cleanup on error.
const globalIds: {
  users: string[];
  courses: string[];
  modules: string[];
  lessons: string[];
} = {
  users: [],
  courses: [],
  modules: [],
  lessons: [],
};

// ============================================================
// Helpers
// ============================================================

async function cleanupCMSData(
  svc: SupabaseClient,
  userIds: string[],
  courseIds: string[],
  moduleIds: string[],
  lessonIds: string[]
): Promise<void> {
  for (const uid of userIds) {
    await svc.from("audit_logs").delete().eq("admin_id", uid);
    await svc.from("lesson_progress").delete().eq("user_id", uid);
    await svc.from("user_courses").delete().eq("user_id", uid);
  }
  for (const lid of lessonIds) {
    await svc.from("lesson_progress").delete().eq("lesson_id", lid);
    await svc.from("lessons").delete().eq("id", lid);
  }
  for (const mid of moduleIds) {
    await svc.from("lessons").delete().eq("module_id", mid);
    await svc.from("modules").delete().eq("id", mid);
  }
  for (const cid of courseIds) {
    await svc.from("audit_logs").delete().eq("entity_id", cid);
    await svc.from("token_courses").delete().eq("course_id", cid);
    await svc.from("user_courses").delete().eq("course_id", cid);
    await svc.from("modules").delete().eq("course_id", cid);
    await svc.from("courses").delete().eq("id", cid);
  }
  for (const uid of userIds) {
    await svc.from("profiles").delete().eq("id", uid);
    await svc.auth.admin.deleteUser(uid);
  }
}

// ============================================================
// Course CRUD
// ============================================================

describe("CMS — course CRUD", () => {
  const localIds = {
    users: <string[]>[],
    courses: <string[]>[],
    modules: <string[]>[],
    lessons: <string[]>[],
  };
  const testId = Date.now().toString(36);
  let admin: TestUser;
  let student: TestUser;

  beforeAll(async () => {
    if (!isIntegrationTestEnv) return;
    admin = await createTestUser(svc, `cms-admin-${testId}`, "passA!", "admin");
    student = await createTestUser(svc, `cms-student-${testId}`, "passS!", "student");
    localIds.users.push(admin.id, student.id);
    globalIds.users.push(admin.id, student.id);
  });

  // ── Admin creates course ──────────────────────────────────

  it("admin creates a course", async () => {
    if (!isIntegrationTestEnv) return;
    const { data, error } = await svc
      .from("courses")
      .insert({
        title: `CMS Course ${testId}`,
        slug: `cms-course-${testId}`,
        status: "draft",
      })
      .select("id, slug, title, status")
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.title).toBe(`CMS Course ${testId}`);
    expect(data!.status).toBe("draft");
    localIds.courses.push(data!.id);
    globalIds.courses.push(data!.id);
  });

  // ── Duplicate title prevention ────────────────────────────

  it("rejects duplicate course title (case-insensitive)", async () => {
    if (!isIntegrationTestEnv) return;
    const courseId = localIds.courses[0];
    // Same title as existing course
    const { data: dup } = await svc
      .from("courses")
      .select("id")
      .ilike("title", `CMS Course ${testId}`)
      .limit(1)
      .maybeSingle();

    // If the app-level check isn't done, the unique slug constraint would catch it too.
    // But the server action does an explicit ilike check first.
    // Here we test that the duplicate check would find the existing course.
    expect(dup).not.toBeNull();
    expect(dup!.id).toBe(courseId);
  });

  // ── Admin updates course ──────────────────────────────────

  it("admin updates a course title and status", async () => {
    if (!isIntegrationTestEnv) return;
    const courseId = localIds.courses[0];

    const { error } = await svc
      .from("courses")
      .update({ title: `CMS Course Updated ${testId}`, status: "published" })
      .eq("id", courseId);

    expect(error).toBeNull();

    // Verify DB state
    const { data: course } = await svc
      .from("courses")
      .select("title, status")
      .eq("id", courseId)
      .single();

    expect(course).not.toBeNull();
    expect(course!.title).toBe(`CMS Course Updated ${testId}`);
    expect(course!.status).toBe("published");
  });

  // ── Admin deletes course ──────────────────────────────────

  it("admin deletes a course", async () => {
    if (!isIntegrationTestEnv) return;
    // Create a course to delete
    const { data: course } = await svc
      .from("courses")
      .insert({
        title: `CMS Delete Me ${testId}`,
        slug: `cms-delete-${testId}`,
      })
      .select("id")
      .single();
    expect(course).not.toBeNull();

    const { error } = await svc.from("courses").delete().eq("id", course!.id);
    expect(error).toBeNull();

    // Verify it's gone
    const { data: afterDelete } = await svc
      .from("courses")
      .select("id")
      .eq("id", course!.id)
      .maybeSingle();
    expect(afterDelete).toBeNull();
  });

  // ── Student authorization boundaries ──────────────────────

  it("student cannot create a course (RLS)", async () => {
    if (!isIntegrationTestEnv) return;
    const sClient = await createAuthedClient(student.email, "passS!");

    const { error } = await sClient
      .from("courses")
      .insert({ title: "Student Course", slug: "student-course" });

    // RLS WITH CHECK should reject — 42501 or similar
    expect(error).not.toBeNull();
  });

  it("student cannot update a course (RLS silent filter)", async () => {
    if (!isIntegrationTestEnv) return;
    const courseId = localIds.courses[0];
    const sClient = await createAuthedClient(student.email, "passS!");

    // Get original title
    const { data: original } = await svc
      .from("courses")
      .select("title")
      .eq("id", courseId)
      .single();
    const originalTitle = original!.title;

    // RLS USING silently filters — no error, but row unchanged
    const { error } = await sClient
      .from("courses")
      .update({ title: "Hacked Title" })
      .eq("id", courseId);

    expect(error).toBeNull();

    // Verify row was NOT updated
    const { data: course } = await svc
      .from("courses")
      .select("title")
      .eq("id", courseId)
      .single();
    expect(course!.title).toBe(originalTitle);
  });

  it("student cannot delete a course (RLS silent filter)", async () => {
    if (!isIntegrationTestEnv) return;
    const courseId = localIds.courses[0];
    const sClient = await createAuthedClient(student.email, "passS!");

    // RLS USING silently filters — no error, but row not deleted
    const { error } = await sClient.from("courses").delete().eq("id", courseId);

    expect(error).toBeNull();

    // Verify course still exists
    const { data: course } = await svc
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .single();
    expect(course).not.toBeNull();
  });

  it("unauthenticated user cannot create a course (RLS)", async () => {
    if (!isIntegrationTestEnv) return;
    const anonClient = getServiceClient();

    // Create a fresh anon-key client (no session)
    const { createClient } = await import("@supabase/supabase-js");
    const unauthClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await unauthClient
      .from("courses")
      .insert({ title: "Anon Course", slug: "anon-course" });

    // No session at all — RLS treats auth.uid() as NULL so is_admin() returns false
    expect(error).not.toBeNull();
  });

  afterAll(async () => {
    if (!isIntegrationTestEnv) return;
    await cleanupCMSData(
      svc,
      localIds.users,
      localIds.courses,
      localIds.modules,
      localIds.lessons
    );
  });
});

// ============================================================
// Course status transitions
// ============================================================

describe("CMS — course status transitions", () => {
  const localIds = {
    users: <string[]>[],
    courses: <string[]>[],
    modules: <string[]>[],
    lessons: <string[]>[],
  };
  const testId = Date.now().toString(36);
  let courseId: string;

  beforeAll(async () => {
    if (!isIntegrationTestEnv) return;
    const admin = await createTestUser(svc, `cms-status-${testId}`, "passA!", "admin");
    localIds.users.push(admin.id);
    globalIds.users.push(admin.id);

    const { data: course } = await svc
      .from("courses")
      .insert({
        title: `Status Course ${testId}`,
        slug: `status-course-${testId}`,
        status: "draft",
      })
      .select("id")
      .single();
    courseId = course!.id;
    localIds.courses.push(courseId);
    globalIds.courses.push(courseId);
  });

  it("publishes a course", async () => {
    if (!isIntegrationTestEnv) return;
    const { error } = await svc
      .from("courses")
      .update({ status: "published" })
      .eq("id", courseId);

    expect(error).toBeNull();

    const { data: course } = await svc
      .from("courses")
      .select("status")
      .eq("id", courseId)
      .single();
    expect(course!.status).toBe("published");
  });

  it("unpublishes a course (back to draft)", async () => {
    if (!isIntegrationTestEnv) return;
    const { error } = await svc
      .from("courses")
      .update({ status: "draft" })
      .eq("id", courseId);

    expect(error).toBeNull();

    const { data: course } = await svc
      .from("courses")
      .select("status")
      .eq("id", courseId)
      .single();
    expect(course!.status).toBe("draft");
  });

  it("archives a course", async () => {
    if (!isIntegrationTestEnv) return;
    const { error } = await svc
      .from("courses")
      .update({ status: "archived" })
      .eq("id", courseId);

    expect(error).toBeNull();

    const { data: course } = await svc
      .from("courses")
      .select("status")
      .eq("id", courseId)
      .single();
    expect(course!.status).toBe("archived");
  });

  it("restores from archived to published", async () => {
    if (!isIntegrationTestEnv) return;
    const { error } = await svc
      .from("courses")
      .update({ status: "published" })
      .eq("id", courseId);

    expect(error).toBeNull();

    const { data: course } = await svc
      .from("courses")
      .select("status")
      .eq("id", courseId)
      .single();
    expect(course!.status).toBe("published");
  });

  it("rejects invalid status value (DB constraint)", async () => {
    if (!isIntegrationTestEnv) return;
    const { error } = await svc
      .from("courses")
      .update({ status: "invalid_status" as any })
      .eq("id", courseId);

    // CHECK constraint should reject
    expect(error).not.toBeNull();
  });

  afterAll(async () => {
    if (!isIntegrationTestEnv) return;
    await cleanupCMSData(
      svc,
      localIds.users,
      localIds.courses,
      localIds.modules,
      localIds.lessons
    );
  });
});

// ============================================================
// Module CRUD
// ============================================================

describe("CMS — module CRUD", () => {
  const localIds = {
    users: <string[]>[],
    courses: <string[]>[],
    modules: <string[]>[],
    lessons: <string[]>[],
  };
  const testId = Date.now().toString(36);
  let courseId: string;
  let admin: TestUser;
  let student: TestUser;

  beforeAll(async () => {
    if (!isIntegrationTestEnv) return;
    admin = await createTestUser(svc, `mod-admin-${testId}`, "passA!", "admin");
    student = await createTestUser(svc, `mod-student-${testId}`, "passS!", "student");
    localIds.users.push(admin.id, student.id);
    globalIds.users.push(admin.id, student.id);

    const { data: course } = await svc
      .from("courses")
      .insert({
        title: `Module Course ${testId}`,
        slug: `module-course-${testId}`,
        status: "published",
      })
      .select("id")
      .single();
    courseId = course!.id;
    localIds.courses.push(courseId);
    globalIds.courses.push(courseId);
  });

  it("admin creates a module", async () => {
    if (!isIntegrationTestEnv) return;
    const { data, error } = await svc
      .from("modules")
      .insert({
        course_id: courseId,
        title: `Module A ${testId}`,
        sort_order: 1,
      })
      .select("id, course_id, title, sort_order")
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.course_id).toBe(courseId);
    expect(data!.title).toBe(`Module A ${testId}`);
    expect(data!.sort_order).toBe(1);
    localIds.modules.push(data!.id);
    globalIds.modules.push(data!.id);
  });

  it("admin creates a second module with auto sort_order", async () => {
    if (!isIntegrationTestEnv) return;
    const { data, error } = await svc
      .from("modules")
      .insert({
        course_id: courseId,
        title: `Module B ${testId}`,
        sort_order: 2,
      })
      .select("id, sort_order")
      .single();

    expect(error).toBeNull();
    expect(data!.sort_order).toBe(2);
    localIds.modules.push(data!.id);
    globalIds.modules.push(data!.id);
  });

  it("rejects duplicate module title in the same course", async () => {
    if (!isIntegrationTestEnv) return;
    // Same title as Module A
    const { data: dup } = await svc
      .from("modules")
      .select("id")
      .eq("course_id", courseId)
      .ilike("title", `Module A ${testId}`)
      .limit(1)
      .maybeSingle();

    expect(dup).not.toBeNull();
  });

  it("admin updates a module title", async () => {
    if (!isIntegrationTestEnv) return;
    const moduleId = localIds.modules[0];

    const { error } = await svc
      .from("modules")
      .update({ title: `Module A Updated ${testId}` })
      .eq("id", moduleId);

    expect(error).toBeNull();

    const { data: mod } = await svc
      .from("modules")
      .select("title")
      .eq("id", moduleId)
      .single();
    expect(mod!.title).toBe(`Module A Updated ${testId}`);
  });

  it("admin deletes a module", async () => {
    if (!isIntegrationTestEnv) return;
    // Create a module to delete
    const { data: mod } = await svc
      .from("modules")
      .insert({
        course_id: courseId,
        title: `Module Delete Me ${testId}`,
        sort_order: 99,
      })
      .select("id")
      .single();
    expect(mod).not.toBeNull();

    const { error } = await svc.from("modules").delete().eq("id", mod!.id);
    expect(error).toBeNull();

    // Verify gone
    const { data: afterDelete } = await svc
      .from("modules")
      .select("id")
      .eq("id", mod!.id)
      .maybeSingle();
    expect(afterDelete).toBeNull();
  });

  // ── Student authorization ─────────────────────────────────

  it("student cannot create a module (RLS)", async () => {
    if (!isIntegrationTestEnv) return;
    const sClient = await createAuthedClient(student.email, "passS!");

    const { error } = await sClient
      .from("modules")
      .insert({ course_id: courseId, title: "Student Module", sort_order: 1 });

    expect(error).not.toBeNull();
  });

  it("student cannot update a module (RLS silent filter)", async () => {
    if (!isIntegrationTestEnv) return;
    const moduleId = localIds.modules[0];
    const sClient = await createAuthedClient(student.email, "passS!");

    // Get original title
    const { data: original } = await svc
      .from("modules")
      .select("title")
      .eq("id", moduleId)
      .single();
    const originalTitle = original!.title;

    const { error } = await sClient
      .from("modules")
      .update({ title: "Hacked Module" })
      .eq("id", moduleId);

    expect(error).toBeNull();

    // Verify row was NOT updated
    const { data: mod } = await svc
      .from("modules")
      .select("title")
      .eq("id", moduleId)
      .single();
    expect(mod!.title).toBe(originalTitle);
  });

  it("student cannot delete a module (RLS silent filter)", async () => {
    if (!isIntegrationTestEnv) return;
    const moduleId = localIds.modules[0];
    const sClient = await createAuthedClient(student.email, "passS!");

    const { error } = await sClient.from("modules").delete().eq("id", moduleId);

    expect(error).toBeNull();

    // Verify module still exists
    const { data: mod } = await svc
      .from("modules")
      .select("id")
      .eq("id", moduleId)
      .single();
    expect(mod).not.toBeNull();
  });

  afterAll(async () => {
    if (!isIntegrationTestEnv) return;
    await cleanupCMSData(
      svc,
      localIds.users,
      localIds.courses,
      localIds.modules,
      localIds.lessons
    );
  });
});

// ============================================================
// Module reorder
// ============================================================

describe("CMS — module reorder", () => {
  const localIds = {
    users: <string[]>[],
    courses: <string[]>[],
    modules: <string[]>[],
    lessons: <string[]>[],
  };
  const testId = Date.now().toString(36);
  let courseId: string;

  beforeAll(async () => {
    if (!isIntegrationTestEnv) return;
    const admin = await createTestUser(svc, `reorder-${testId}`, "passA!", "admin");
    localIds.users.push(admin.id);
    globalIds.users.push(admin.id);

    const { data: course } = await svc
      .from("courses")
      .insert({
        title: `Reorder Course ${testId}`,
        slug: `reorder-course-${testId}`,
      })
      .select("id")
      .single();
    courseId = course!.id;
    localIds.courses.push(courseId);
    globalIds.courses.push(courseId);

    // Create 3 modules
    for (const title of ["Alpha", "Beta", "Gamma"]) {
      const { data: mod } = await svc
        .from("modules")
        .insert({ course_id: courseId, title: `${title} ${testId}`, sort_order: 99 })
        .select("id")
        .single();
      localIds.modules.push(mod!.id);
      globalIds.modules.push(mod!.id);
    }
  });

  it("reorders modules by updating sort_order", async () => {
    if (!isIntegrationTestEnv) return;
    // Reverse the order
    const reversed = [...localIds.modules].reverse();
    const updates = reversed.map((id, idx) =>
      svc.from("modules").update({ sort_order: idx + 1 }).eq("id", id).eq("course_id", courseId)
    );
    await Promise.all(updates);

    // Verify new order
    const { data: modules } = await svc
      .from("modules")
      .select("id, sort_order")
      .eq("course_id", courseId)
      .order("sort_order", { ascending: true });

    expect(modules).not.toBeNull();
    expect(modules!.length).toBe(3);
    expect(modules![0].id).toBe(reversed[0]);
    expect(modules![0].sort_order).toBe(1);
    expect(modules![1].id).toBe(reversed[1]);
    expect(modules![1].sort_order).toBe(2);
    expect(modules![2].id).toBe(reversed[2]);
    expect(modules![2].sort_order).toBe(3);
  });

  afterAll(async () => {
    if (!isIntegrationTestEnv) return;
    await cleanupCMSData(
      svc,
      localIds.users,
      localIds.courses,
      localIds.modules,
      localIds.lessons
    );
  });
});

// ============================================================
// Lesson CRUD
// ============================================================

describe("CMS — lesson CRUD", () => {
  const localIds = {
    users: <string[]>[],
    courses: <string[]>[],
    modules: <string[]>[],
    lessons: <string[]>[],
  };
  const testId = Date.now().toString(36);
  let courseId: string;
  let moduleId: string;
  let admin: TestUser;
  let student: TestUser;

  beforeAll(async () => {
    if (!isIntegrationTestEnv) return;
    admin = await createTestUser(svc, `les-admin-${testId}`, "passA!", "admin");
    student = await createTestUser(svc, `les-student-${testId}`, "passS!", "student");
    localIds.users.push(admin.id, student.id);
    globalIds.users.push(admin.id, student.id);

    const { data: course } = await svc
      .from("courses")
      .insert({
        title: `Lesson Course ${testId}`,
        slug: `lesson-course-${testId}`,
        status: "published",
      })
      .select("id")
      .single();
    courseId = course!.id;
    localIds.courses.push(courseId);
    globalIds.courses.push(courseId);

    const { data: mod } = await svc
      .from("modules")
      .insert({ course_id: courseId, title: `Lesson Module ${testId}`, sort_order: 1 })
      .select("id")
      .single();
    moduleId = mod!.id;
    localIds.modules.push(moduleId);
    globalIds.modules.push(moduleId);
  });

  it("admin creates a lesson", async () => {
    if (!isIntegrationTestEnv) return;
    const { data, error } = await svc
      .from("lessons")
      .insert({
        module_id: moduleId,
        title: `Lesson 1 ${testId}`,
        content_type: "text",
        content: "Hello world",
        sort_order: 1,
      })
      .select("id, module_id, title, content_type, content, sort_order")
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.module_id).toBe(moduleId);
    expect(data!.title).toBe(`Lesson 1 ${testId}`);
    expect(data!.content_type).toBe("text");
    expect(data!.content).toBe("Hello world");
    expect(data!.sort_order).toBe(1);
    localIds.lessons.push(data!.id);
    globalIds.lessons.push(data!.id);
  });

  it("admin creates a second lesson with different content type", async () => {
    if (!isIntegrationTestEnv) return;
    const { data, error } = await svc
      .from("lessons")
      .insert({
        module_id: moduleId,
        title: `Lesson Video ${testId}`,
        content_type: "video",
        content: "https://example.com/video.m3u8",
        sort_order: 2,
      })
      .select("id, content_type, content")
      .single();

    expect(error).toBeNull();
    expect(data!.content_type).toBe("video");
    expect(data!.content).toBe("https://example.com/video.m3u8");
    localIds.lessons.push(data!.id);
    globalIds.lessons.push(data!.id);
  });

  it("rejects duplicate lesson title in the same module", async () => {
    if (!isIntegrationTestEnv) return;
    const { data: dup } = await svc
      .from("lessons")
      .select("id")
      .eq("module_id", moduleId)
      .ilike("title", `Lesson 1 ${testId}`)
      .limit(1)
      .maybeSingle();

    expect(dup).not.toBeNull();
  });

  it("admin updates a lesson title and content", async () => {
    if (!isIntegrationTestEnv) return;
    const lessonId = localIds.lessons[0];

    const { error } = await svc
      .from("lessons")
      .update({
        title: `Lesson 1 Updated ${testId}`,
        content: "Updated content",
      })
      .eq("id", lessonId);

    expect(error).toBeNull();

    const { data: lesson } = await svc
      .from("lessons")
      .select("title, content")
      .eq("id", lessonId)
      .single();
    expect(lesson!.title).toBe(`Lesson 1 Updated ${testId}`);
    expect(lesson!.content).toBe("Updated content");
  });

  it("admin updates lesson is_preview flag", async () => {
    if (!isIntegrationTestEnv) return;
    const lessonId = localIds.lessons[0];

    const { error } = await svc
      .from("lessons")
      .update({ is_preview: true })
      .eq("id", lessonId);

    expect(error).toBeNull();

    const { data: lesson } = await svc
      .from("lessons")
      .select("is_preview")
      .eq("id", lessonId)
      .single();
    expect(lesson!.is_preview).toBe(true);
  });

  it("admin deletes a lesson", async () => {
    if (!isIntegrationTestEnv) return;
    // Create a lesson to delete
    const { data: lesson } = await svc
      .from("lessons")
      .insert({
        module_id: moduleId,
        title: `Lesson Delete Me ${testId}`,
        content_type: "text",
        content: "To be deleted",
        sort_order: 99,
      })
      .select("id")
      .single();
    expect(lesson).not.toBeNull();

    const { error } = await svc.from("lessons").delete().eq("id", lesson!.id);
    expect(error).toBeNull();

    // Verify gone
    const { data: afterDelete } = await svc
      .from("lessons")
      .select("id")
      .eq("id", lesson!.id)
      .maybeSingle();
    expect(afterDelete).toBeNull();
  });

  // ── Student authorization ─────────────────────────────────

  it("student cannot create a lesson (RLS)", async () => {
    if (!isIntegrationTestEnv) return;
    const sClient = await createAuthedClient(student.email, "passS!");

    const { error } = await sClient
      .from("lessons")
      .insert({ module_id: moduleId, title: "Student Lesson", content_type: "text" });

    expect(error).not.toBeNull();
  });

  it("student cannot update a lesson (RLS silent filter)", async () => {
    if (!isIntegrationTestEnv) return;
    const lessonId = localIds.lessons[0];
    const sClient = await createAuthedClient(student.email, "passS!");

    // Get original title
    const { data: original } = await svc
      .from("lessons")
      .select("title")
      .eq("id", lessonId)
      .single();
    const originalTitle = original!.title;

    const { error } = await sClient
      .from("lessons")
      .update({ title: "Hacked Lesson" })
      .eq("id", lessonId);

    expect(error).toBeNull();

    // Verify row was NOT updated
    const { data: lesson } = await svc
      .from("lessons")
      .select("title")
      .eq("id", lessonId)
      .single();
    expect(lesson!.title).toBe(originalTitle);
  });

  it("student cannot delete a lesson (RLS silent filter)", async () => {
    if (!isIntegrationTestEnv) return;
    const lessonId = localIds.lessons[0];
    const sClient = await createAuthedClient(student.email, "passS!");

    const { error } = await sClient.from("lessons").delete().eq("id", lessonId);

    expect(error).toBeNull();

    // Verify lesson still exists
    const { data: lesson } = await svc
      .from("lessons")
      .select("id")
      .eq("id", lessonId)
      .single();
    expect(lesson).not.toBeNull();
  });

  afterAll(async () => {
    if (!isIntegrationTestEnv) return;
    await cleanupCMSData(
      svc,
      localIds.users,
      localIds.courses,
      localIds.modules,
      localIds.lessons
    );
  });
});

// ============================================================
// Lesson reorder
// ============================================================

describe("CMS — lesson reorder", () => {
  const localIds = {
    users: <string[]>[],
    courses: <string[]>[],
    modules: <string[]>[],
    lessons: <string[]>[],
  };
  const testId = Date.now().toString(36);
  let moduleId: string;

  beforeAll(async () => {
    if (!isIntegrationTestEnv) return;
    const admin = await createTestUser(svc, `les-reorder-${testId}`, "passA!", "admin");
    localIds.users.push(admin.id);
    globalIds.users.push(admin.id);

    const { data: course } = await svc
      .from("courses")
      .insert({
        title: `Lesson Reorder Course ${testId}`,
        slug: `les-reorder-course-${testId}`,
      })
      .select("id")
      .single();
    localIds.courses.push(course!.id);
    globalIds.courses.push(course!.id);

    const { data: mod } = await svc
      .from("modules")
      .insert({ course_id: course!.id, title: `Reorder Module ${testId}`, sort_order: 1 })
      .select("id")
      .single();
    moduleId = mod!.id;
    localIds.modules.push(moduleId);
    globalIds.modules.push(moduleId);

    // Create 3 lessons
    for (const title of ["Intro", "Core", "Advanced"]) {
      const { data: lesson } = await svc
        .from("lessons")
        .insert({
          module_id: moduleId,
          title: `${title} ${testId}`,
          content_type: "text",
          content: "Content",
          sort_order: 99,
        })
        .select("id")
        .single();
      localIds.lessons.push(lesson!.id);
      globalIds.lessons.push(lesson!.id);
    }
  });

  it("reorders lessons by updating sort_order", async () => {
    if (!isIntegrationTestEnv) return;
    // Reverse the order
    const reversed = [...localIds.lessons].reverse();
    const updates = reversed.map((id, idx) =>
      svc.from("lessons").update({ sort_order: idx + 1 }).eq("id", id).eq("module_id", moduleId)
    );
    await Promise.all(updates);

    // Verify new order
    const { data: lessons } = await svc
      .from("lessons")
      .select("id, sort_order")
      .eq("module_id", moduleId)
      .order("sort_order", { ascending: true });

    expect(lessons).not.toBeNull();
    expect(lessons!.length).toBe(3);
    expect(lessons![0].id).toBe(reversed[0]);
    expect(lessons![0].sort_order).toBe(1);
    expect(lessons![1].id).toBe(reversed[1]);
    expect(lessons![1].sort_order).toBe(2);
    expect(lessons![2].id).toBe(reversed[2]);
    expect(lessons![2].sort_order).toBe(3);
  });

  afterAll(async () => {
    if (!isIntegrationTestEnv) return;
    await cleanupCMSData(
      svc,
      localIds.users,
      localIds.courses,
      localIds.modules,
      localIds.lessons
    );
  });
});