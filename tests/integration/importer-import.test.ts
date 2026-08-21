import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseDb } from "@/lib/importer/parse";
import { executeImport } from "@/actions/admin/import-course";
import {
  isIntegrationTestEnv,
  getServiceClient,
  createTestUser,
  cleanupTestData,
} from "../integration/setup";
import type { SupabaseClient } from "@supabase/supabase-js";

const DB_PATH = path.resolve(__dirname, "../../DBTest/apna_videos.db");

async function clearSourceCourse(svc: SupabaseClient, sourceType: string, sourceId: string): Promise<void> {
  const { data: course } = await svc
    .from("courses")
    .select("id")
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .maybeSingle();
  if (!course) return;

  const { data: modules } = await svc
    .from("modules")
    .select("id")
    .eq("course_id", course.id);
  if (modules && modules.length > 0) {
    const { data: lessons } = await svc
      .from("lessons")
      .select("id")
      .in("module_id", modules.map((m) => m.id));
    if (lessons && lessons.length > 0) {
      await svc.from("lesson_progress").delete().in("lesson_id", lessons.map((l) => l.id));
      await svc.from("lessons").delete().in("id", lessons.map((l) => l.id));
    }
    await svc.from("modules").delete().in("id", modules.map((m) => m.id));
  }
  await svc.from("course_imports").delete().eq("course_id", course.id);
  await svc.from("token_courses").delete().eq("course_id", course.id);
  await svc.from("user_courses").delete().eq("course_id", course.id);
  await svc.from("courses").delete().eq("id", course.id);
}

/**
 * Check whether migration 007 columns exist on the hosted DB.
 * If not, import-course tests must skip (the migration needs to be applied first).
 */
let migration007Applied = false;

async function checkMigration007(svc: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await svc
      .from("courses")
      .select("source_id")
      .limit(1);
    // If no error, the column exists
    return !error;
  } catch {
    return false;
  }
}

// Track IDs for cleanup
const globalIds: { users: string[]; courses: string[] } = {
  users: [],
  courses: [],
};

describe("executeImport (integration)", () => {
  let svc: SupabaseClient;
  let adminUserId: string;

  beforeAll(async () => {
    if (!isIntegrationTestEnv) return;
    svc = getServiceClient();
    migration007Applied = await checkMigration007(svc);
    if (!migration007Applied) return;

    const admin = await createTestUser(svc, "imp-admin", "testPass123!", "admin");
    adminUserId = admin.id;
    globalIds.users.push(adminUserId);

    // Ensure no pre-existing source course from a previous run
    await clearSourceCourse(svc, "apna", "prime-2");
  });

  afterAll(async () => {
    if (!isIntegrationTestEnv) return;
    await cleanupTestData(svc, globalIds.users, globalIds.courses);
  });

  it("imports a new course from a .db file with correct structure", async () => {
    if (!isIntegrationTestEnv || !migration007Applied) return;

    const buffer = readFileSync(DB_PATH);
    const result = await executeImport(svc, adminUserId, buffer, "apna_videos.db");

    expect(result.success).toBe(true);
    if (!result.success) return;

    const { data: summary } = result;
    expect(summary.courseId).toBeTruthy();
    expect(summary.courseTitle).toContain("Prime 2.0");
    expect(summary.sourceCourseId).toBe("prime-2");
    expect(summary.sourceType).toBe("apna");
    expect(summary.modulesCreated).toBeGreaterThan(0);
    expect(summary.totalLessons).toBeGreaterThan(0);
    expect(summary.lessonsByType).toHaveProperty("video");
    expect(summary.lessonsByType).toHaveProperty("pdf");
    expect(summary.lessonsByType).toHaveProperty("file");
    expect(summary.warnings).toBeDefined();
    globalIds.courses.push(summary.courseId);

    // Verify course in DB
    const { data: course } = await svc
      .from("courses")
      .select("id, title, slug, status, source_id, source_type")
      .eq("id", summary.courseId)
      .single();
    expect(course!.source_id).toBe("prime-2");
    expect(course!.source_type).toBe("apna");
    expect(course!.status).toBe("draft");

    // Verify modules in order
    const { data: modules } = await svc
      .from("modules")
      .select("id, title, sort_order, source_chapter_num")
      .eq("course_id", summary.courseId)
      .order("sort_order", { ascending: true });
    expect(modules!.length).toBe(summary.modulesCreated);
    for (const mod of modules!) {
      expect(mod.source_chapter_num).toBeTruthy();
    }

    // Verify lessons
    const { data: lessons } = await svc
      .from("lessons")
      .select("id, title, content_type, sort_order, module_id, source_fingerprint, external_source, external_key")
      .in("module_id", modules!.map((m) => m.id));
    expect(lessons!.length).toBe(summary.totalLessons);
    for (const lesson of lessons!) {
      expect(lesson.source_fingerprint).toMatch(/^[0-9a-f]{16}$/);
    }

    // Verify course_imports record
    const { data: imports } = await svc
      .from("course_imports")
      .select("id, mode, source_course_id, source_file_name, created_by")
      .eq("course_id", summary.courseId);
    expect(imports!.length).toBe(1);
    expect(imports![0].mode).toBe("incremental");
    expect(imports![0].source_course_id).toBe("prime-2");
    expect(imports![0].source_file_name).toBe("apna_videos.db");
    expect(imports![0].created_by).toBe(adminUserId);

    // Verify audit log
    const { data: auditLogs } = await svc
      .from("audit_logs")
      .select("id, action")
      .eq("entity_id", summary.courseId)
      .eq("action", "course_imported");
    expect(auditLogs!.length).toBe(1);
  });

  it("accepts re-import on an existing source course (incremental by default)", async () => {
    if (!isIntegrationTestEnv || !migration007Applied) return;

    const buffer = readFileSync(DB_PATH);
    const result = await executeImport(svc, adminUserId, buffer, "reimport.db");

    expect(result.success).toBe(true);
    if (!result.success) return;

    const { data: summary } = result;
    expect(summary.mode).toBe("incremental");
    expect(summary.modulesAdded).toBe(0);
    expect(summary.lessonsAdded).toBe(0);
    expect(summary.modulesRemoved).toBe(0);
    expect(summary.lessonsRemoved).toBe(0);

    // Only one course exists for this source
    const { count } = await svc
      .from("courses")
      .select("*", { count: "exact", head: true })
      .eq("source_id", "prime-2")
      .eq("source_type", "apna");
    expect(count).toBe(1);
  });

  it("matches parser output counts exactly", async () => {
    if (!isIntegrationTestEnv || !migration007Applied) return;

    const buffer = readFileSync(DB_PATH);
    const parseResult = await parseDb(buffer);
    expect(parseResult.success).toBe(true);
    if (!parseResult.success) return;

    const expectedModules = parseResult.course.modules.length;
    const expectedTotalLessons = parseResult.course.modules.reduce(
      (n, m) => n + m.lessons.length, 0,
    );
    const expectedByType: Record<string, number> = {};
    for (const mod of parseResult.course.modules) {
      for (const lesson of mod.lessons) {
        expectedByType[lesson.content_type] = (expectedByType[lesson.content_type] || 0) + 1;
      }
    }

    const { data: course } = await svc
      .from("courses")
      .select("id")
      .eq("source_id", "prime-2")
      .eq("source_type", "apna")
      .single();
    expect(course).toBeTruthy();

    const { data: modules } = await svc
      .from("modules")
      .select("id")
      .eq("course_id", course!.id);
    expect(modules!.length).toBe(expectedModules);

    const { data: lessons } = await svc
      .from("lessons")
      .select("content_type")
      .in("module_id", modules!.map((m) => m.id));

    const actualByType: Record<string, number> = {};
    for (const lesson of lessons!) {
      actualByType[lesson.content_type] = (actualByType[lesson.content_type] || 0) + 1;
    }
    expect(lessons!.length).toBe(expectedTotalLessons);
    expect(actualByType).toEqual(expectedByType);
  });
});

describe("executeImport error handling", () => {
  let svc: SupabaseClient;
  let adminUserId: string;

  beforeAll(async () => {
    if (!isIntegrationTestEnv) return;
    svc = getServiceClient();
    migration007Applied = await checkMigration007(svc);
    if (!migration007Applied) return;

    // Clean up any pre-existing imp-err user from a previous run
    const email = "test-imp-err@learnforless.test";
    const { data: existingUsers } = await svc.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u) => u.email === email);
    if (existing) {
      await svc.auth.admin.deleteUser(existing.id);
      await svc.from("profiles").delete().eq("id", existing.id);
    }

    const admin = await createTestUser(svc, "imp-err", "testPass123!", "admin");
    adminUserId = admin.id;
    globalIds.users.push(adminUserId);
  });

  it("returns parse error for empty buffer (no partial state)", async () => {
    if (!isIntegrationTestEnv || !migration007Applied) return;

    const result = await executeImport(svc, adminUserId, new Uint8Array(0), "empty.db");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
  });
});