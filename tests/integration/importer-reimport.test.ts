import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { executeImport } from "@/actions/admin/import-course";
import {
  isIntegrationTestEnv,
  getServiceClient,
  createTestUser,
  cleanupTestData,
  assignStudentToCourse,
} from "../integration/setup";
import type { SupabaseClient } from "@supabase/supabase-js";

const DB_PATH = path.resolve(__dirname, "../../DBTest/apna_videos.db");

async function importFresh(
  svc: SupabaseClient,
  adminUserId: string,
): Promise<string | null> {
  const buffer = readFileSync(DB_PATH);
  const result = await executeImport(svc, adminUserId, buffer, "fresh.db");
  if (!result.success) {
    console.error(`importFresh failed: ${result.error}`);
    return null;
  }
  return result.data.courseId;
}

async function countModules(
  svc: SupabaseClient,
  courseId: string,
): Promise<number> {
  const { count } = await svc
    .from("modules")
    .select("*", { count: "exact", head: true })
    .eq("course_id", courseId);
  return count ?? 0;
}

async function countLessons(
  svc: SupabaseClient,
  courseId: string,
): Promise<number> {
  const { data: modules } = await svc
    .from("modules")
    .select("id")
    .eq("course_id", courseId);
  if (!modules || modules.length === 0) return 0;
  const { count } = await svc
    .from("lessons")
    .select("*", { count: "exact", head: true })
    .in("module_id", modules.map((m) => m.id));
  return count ?? 0;
}

// ============================================================
// INCREMENTAL RE-IMPORT
// ============================================================

describe("incremental re-import (integration)", () => {
  let svc: SupabaseClient;
  let adminUserId: string;
  let courseId: string | null = null;

  beforeAll(async () => {
    if (!isIntegrationTestEnv) return;
    svc = getServiceClient();

    // Clean up any pre-existing user from a previous run
    const email = "test-reinc-admin@learnforless.test";
    const { data: existingUsers } = await svc.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u) => u.email === email);
    if (existing) {
      await svc.from("profiles").delete().eq("id", existing.id);
      await svc.auth.admin.deleteUser(existing.id);
    }

    const admin = await createTestUser(svc, "reinc-admin", "testPass123!", "admin");
    adminUserId = admin.id;
  });

  beforeEach(async () => {
    if (!isIntegrationTestEnv) return;
    courseId = await importFresh(svc, adminUserId);
  });

  afterEach(async () => {
    if (!isIntegrationTestEnv) return;
    if (courseId) {
      await cleanupTestData(svc, [], [courseId]);
    }
  });

  afterAll(async () => {
    if (!isIntegrationTestEnv) return;
    if (adminUserId) {
      await cleanupTestData(svc, [adminUserId], []);
    }
  });

  it("re-import with no changes: zero modules/lessons added", async () => {
    if (!isIntegrationTestEnv || !courseId) return;

    const buffer = readFileSync(DB_PATH);
    const result = await executeImport(
      svc,
      adminUserId,
      buffer,
      "reimport.db",
      "incremental",
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    const summary = result.data;
    expect(summary.mode).toBe("incremental");
    expect(summary.modulesAdded).toBe(0);
    expect(summary.lessonsAdded).toBe(0);
    expect(summary.modulesRemoved).toBe(0);
    expect(summary.lessonsRemoved).toBe(0);
  });

  it("deleted module re-added on incremental re-import", async () => {
    if (!isIntegrationTestEnv || !courseId) return;

    const { data: modules } = await svc
      .from("modules")
      .select("id, source_chapter_num")
      .eq("course_id", courseId)
      .not("source_chapter_num", "is", null);

    expect(modules?.length).toBeGreaterThan(0);
    if (!modules || modules.length === 0) return;

    const [target] = modules;
    const chapterNum = target.source_chapter_num;

    await svc.from("modules").delete().eq("id", target.id);

    const buffer = readFileSync(DB_PATH);
    const result = await executeImport(
      svc,
      adminUserId,
      buffer,
      "reimport.db",
      "incremental",
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.modulesAdded).toBe(1);

    const { data: restored } = await svc
      .from("modules")
      .select("id")
      .eq("course_id", courseId)
      .eq("source_chapter_num", chapterNum);

    expect(restored?.length).toBe(1);
  });

  it("deleted lesson re-added on incremental re-import", async () => {
    if (!isIntegrationTestEnv || !courseId) return;

    const { data: modules } = await svc
      .from("modules")
      .select("id")
      .eq("course_id", courseId);
    expect(modules?.length).toBeGreaterThan(0);
    if (!modules || modules.length === 0) return;

    const { data: lessons } = await svc
      .from("lessons")
      .select("id, source_fingerprint")
      .in("module_id", modules.map((m) => m.id))
      .not("source_fingerprint", "is", null);

    expect(lessons?.length).toBeGreaterThan(0);
    if (!lessons || lessons.length === 0) return;

    const targetFingerprint = lessons[0].source_fingerprint;

    await svc.from("lessons").delete().eq("id", lessons[0].id);

    const buffer = readFileSync(DB_PATH);
    const result = await executeImport(
      svc,
      adminUserId,
      buffer,
      "reimport.db",
      "incremental",
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.lessonsAdded).toBe(1);

    const { data: restored } = await svc
      .from("lessons")
      .select("id")
      .in("module_id", modules.map((m) => m.id))
      .eq("source_fingerprint", targetFingerprint);

    expect(restored?.length).toBe(1);
  });

  it("manual module (NULL source_chapter_num) preserved across re-import", async () => {
    if (!isIntegrationTestEnv || !courseId) return;

    const originalCount = await countModules(svc, courseId);

    await svc.from("modules").insert({
      course_id: courseId,
      title: "Manual Module",
      sort_order: 999,
    });

    const buffer = readFileSync(DB_PATH);
    const result = await executeImport(
      svc,
      adminUserId,
      buffer,
      "reimport.db",
      "incremental",
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.modulesAdded).toBe(0);

    const finalCount = await countModules(svc, courseId);
    expect(finalCount).toBe(originalCount + 1);
  });

  it("manual lesson (NULL source_fingerprint) preserved across re-import", async () => {
    if (!isIntegrationTestEnv || !courseId) return;

    const { data: modules } = await svc
      .from("modules")
      .select("id")
      .eq("course_id", courseId);
    expect(modules?.length).toBeGreaterThan(0);
    if (!modules || modules.length === 0) return;

    await svc.from("lessons").insert({
      module_id: modules[0].id,
      title: "Manual Lesson",
      content_type: "text",
      content: "Manual content",
      sort_order: 999,
    });

    const buffer = readFileSync(DB_PATH);
    const result = await executeImport(
      svc,
      adminUserId,
      buffer,
      "reimport.db",
      "incremental",
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.lessonsAdded).toBe(0);

    const { data: manualLessons } = await svc
      .from("lessons")
      .select("id")
      .in("module_id", modules.map((m) => m.id))
      .is("source_fingerprint", null);

    expect(manualLessons?.length).toBe(1);
  });

  it("multiple re-imports: no duplicates accumulate", async () => {
    if (!isIntegrationTestEnv || !courseId) return;

    const originalCount = await countLessons(svc, courseId);

    const buffer = readFileSync(DB_PATH);
    const result1 = await executeImport(
      svc,
      adminUserId,
      buffer,
      "re1.db",
      "incremental",
    );
    expect(result1.success).toBe(true);
    if (result1.success) expect(result1.data.lessonsAdded).toBe(0);

    const buffer2 = readFileSync(DB_PATH);
    const result2 = await executeImport(
      svc,
      adminUserId,
      buffer2,
      "re2.db",
      "incremental",
    );
    expect(result2.success).toBe(true);
    if (result2.success) expect(result2.data.lessonsAdded).toBe(0);

    const finalCount = await countLessons(svc, courseId);
    expect(finalCount).toBe(originalCount);
  });
});

// ============================================================
// REPLACEMENT RE-IMPORT
// ============================================================

describe("replacement re-import (integration)", () => {
  let svc: SupabaseClient;
  let adminUserId: string;
  let courseId: string | null = null;

  beforeAll(async () => {
    if (!isIntegrationTestEnv) return;
    svc = getServiceClient();

    // Clean up any pre-existing user from a previous run
    const email = "test-rep-admin@learnforless.test";
    const { data: existingUsers } = await svc.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u) => u.email === email);
    if (existing) {
      await svc.from("profiles").delete().eq("id", existing.id);
      await svc.auth.admin.deleteUser(existing.id);
    }

    const admin = await createTestUser(svc, "rep-admin", "testPass123!", "admin");
    adminUserId = admin.id;
  });

  beforeEach(async () => {
    if (!isIntegrationTestEnv) return;
    courseId = await importFresh(svc, adminUserId);
  });

  afterEach(async () => {
    if (!isIntegrationTestEnv) return;
    if (courseId) {
      await cleanupTestData(svc, [], [courseId]);
    }
  });

  afterAll(async () => {
    if (!isIntegrationTestEnv) return;
    if (adminUserId) {
      await cleanupTestData(svc, [adminUserId], []);
    }
  });

  it("replace: imported lessons removed and recreated", async () => {
    if (!isIntegrationTestEnv || !courseId) return;

    const originalLessonCount = await countLessons(svc, courseId);
    expect(originalLessonCount).toBeGreaterThan(0);

    const buffer = readFileSync(DB_PATH);
    const result = await executeImport(
      svc,
      adminUserId,
      buffer,
      "replace.db",
      "replacement",
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    const summary = result.data;
    expect(summary.mode).toBe("replacement");
    expect(summary.lessonsRemoved).toBe(originalLessonCount);
    expect(summary.lessonsAdded).toBe(originalLessonCount);

    const finalCount = await countLessons(svc, courseId);
    expect(finalCount).toBe(originalLessonCount);
  });

  it("replace: imported modules removed and recreated", async () => {
    if (!isIntegrationTestEnv || !courseId) return;

    const originalModuleCount = await countModules(svc, courseId);
    expect(originalModuleCount).toBeGreaterThan(0);

    const buffer = readFileSync(DB_PATH);
    const result = await executeImport(
      svc,
      adminUserId,
      buffer,
      "replace.db",
      "replacement",
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    const summary = result.data;
    expect(summary.mode).toBe("replacement");
    expect(summary.modulesRemoved).toBe(originalModuleCount);
    expect(summary.modulesAdded).toBe(originalModuleCount);

    const finalCount = await countModules(svc, courseId);
    expect(finalCount).toBe(originalModuleCount);
  });

  it("manual module (NULL source_chapter_num) preserved in replace", async () => {
    if (!isIntegrationTestEnv || !courseId) return;

    const originalCount = await countModules(svc, courseId);

    await svc.from("modules").insert({
      course_id: courseId,
      title: "Manual Module",
      sort_order: 999,
    });

    const buffer = readFileSync(DB_PATH);
    const result = await executeImport(
      svc,
      adminUserId,
      buffer,
      "replace.db",
      "replacement",
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    const finalCount = await countModules(svc, courseId);
    expect(finalCount).toBe(originalCount + 1);
  });

  it("manual lesson (NULL source_fingerprint) preserved in replace", async () => {
    if (!isIntegrationTestEnv || !courseId) return;

    const { data: modules } = await svc
      .from("modules")
      .select("id")
      .eq("course_id", courseId);
    expect(modules?.length).toBeGreaterThan(0);
    if (!modules || modules.length === 0) return;

    await svc.from("lessons").insert({
      module_id: modules[0].id,
      title: "Manual Lesson",
      content_type: "text",
      content: "Manual content",
      sort_order: 999,
    });

    const buffer = readFileSync(DB_PATH);
    const result = await executeImport(
      svc,
      adminUserId,
      buffer,
      "replace.db",
      "replacement",
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    const { data: manualLessons } = await svc
      .from("lessons")
      .select("id")
      .in("module_id", modules.map((m) => m.id))
      .is("source_fingerprint", null);

    expect(manualLessons?.length).toBe(1);
  });

  it("course row preserved across replace", async () => {
    if (!isIntegrationTestEnv || !courseId) return;

    const { data: courseBefore } = await svc
      .from("courses")
      .select("id, title, slug, status")
      .eq("id", courseId)
      .single();
    expect(courseBefore).toBeTruthy();

    const buffer = readFileSync(DB_PATH);
    const result = await executeImport(
      svc,
      adminUserId,
      buffer,
      "replace.db",
      "replacement",
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    const { data: courseAfter } = await svc
      .from("courses")
      .select("id, title, slug, status")
      .eq("id", courseId)
      .single();

    expect(courseAfter!.id).toBe(courseBefore!.id);
    expect(courseAfter!.title).toBe(courseBefore!.title);
    expect(courseAfter!.slug).toBe(courseBefore!.slug);
    expect(courseAfter!.status).toBe(courseBefore!.status);
  });

  it("enrollments preserved across replace", async () => {
    if (!isIntegrationTestEnv || !courseId) return;

    const student = await createTestUser(
      svc,
      "rep-student",
      "testPass123!",
      "student",
    );
    await assignStudentToCourse(svc, student.id, courseId);

    const buffer = readFileSync(DB_PATH);
    const result = await executeImport(
      svc,
      adminUserId,
      buffer,
      "replace.db",
      "replacement",
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    const { data: access } = await svc
      .from("user_courses")
      .select("id")
      .eq("user_id", student.id)
      .eq("course_id", courseId);

    expect(access?.length).toBe(1);

    await cleanupTestData(svc, [student.id], []);
  });

  it("course_imports record created with replacement mode", async () => {
    if (!isIntegrationTestEnv || !courseId) return;

    const buffer = readFileSync(DB_PATH);
    const result = await executeImport(
      svc,
      adminUserId,
      buffer,
      "replace.db",
      "replacement",
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    const { data: imports } = await svc
      .from("course_imports")
      .select("mode, source_file_name")
      .eq("course_id", courseId)
      .order("created_at", { ascending: true });

    expect(imports?.length).toBe(2);
    expect(imports![0].mode).toBe("incremental");
    expect(imports![1].mode).toBe("replacement");
    expect(imports![1].source_file_name).toBe("replace.db");
  });
});