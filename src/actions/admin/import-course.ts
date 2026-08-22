"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { generateSlug } from "@/lib/utils";
import { parseDb } from "@/lib/importer/parse";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ActionResult,
  ImportResult,
  ImportWarning,
  ParsedCourse,
  ParsedLesson,
  ParsedModule,
} from "@/types";

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
// CORE IMPORT LOGIC (testable, no auth dependency)
// ============================================================

/**
 * Execute import with re-import routing:
 * - No existing (source_type, source_id) course → create new course unchanged
 * - Existing course found → use mode:
 *   - "incremental": add only missing modules/lessons, never delete/overwrite
 *   - "replacement": delete obsolete imported content and recreate from source
 *
 * Manual CMS data (NULL source_chapter_num / source_fingerprint) is never
 * touched by either re-import mode.
 */
export async function executeImport(
  adminClient: SupabaseClient,
  adminUserId: string,
  fileBuffer: Uint8Array,
  fileName: string,
  mode: "incremental" | "replacement" = "incremental",
): Promise<ActionResult<ImportResult>> {
  const parseResult = await parseDb(fileBuffer);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error };
  }

  const { course, warnings } = parseResult;

  const { data: existingCourse, error: findError } = await adminClient
    .from("courses")
    .select("id, title")
    .eq("source_type", course.source_type)
    .eq("source_id", course.source_id)
    .maybeSingle();

  if (findError) {
    return { success: false, error: `Failed to find source course: ${findError.message}` };
  }

  if (!existingCourse) {
    return doNewImport(
      adminClient,
      adminUserId,
      course,
      warnings,
      fileName,
    );
  }

  if (mode === "incremental") {
    return doIncrementalImport(
      adminClient,
      adminUserId,
      existingCourse.id,
      course,
      warnings,
      fileName,
    );
  }

  return doReplacementImport(
    adminClient,
    adminUserId,
    existingCourse.id,
    course,
    warnings,
    fileName,
  );
}

// ============================================================
// NEW COURSE IMPORT (existing behavior)
// ============================================================

async function doNewImport(
  adminClient: SupabaseClient,
  adminUserId: string,
  course: ParsedCourse,
  warnings: ImportWarning[],
  fileName: string,
): Promise<ActionResult<ImportResult>> {
  let slug = generateSlug(course.title);
  const { data: slugCollision } = await adminClient
    .from("courses")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (slugCollision) {
    slug = `${slug}-${course.source_id}`;
  }

  let createdCourseId: string | null = null;

  try {
    const { data: newCourse, error: courseError } = await adminClient
      .from("courses")
      .insert({
        title: course.title.trim(),
        slug,
        description: course.description?.trim() ?? null,
        status: "draft",
        source_id: course.source_id,
        source_type: course.source_type,
      })
      .select("id")
      .single();

    if (courseError) {
      throw new Error(`Failed to create course: ${courseError.message}`);
    }
    const newCourseId = newCourse.id;
    createdCourseId = newCourseId;

    const created = await createModules(
      adminClient,
      newCourseId,
      course.modules,
      warnings,
    );

    const summary: ImportResult = {
      mode: "incremental",
      courseId: newCourseId,
      courseTitle: course.title,
      sourceCourseId: course.source_id,
      sourceType: course.source_type,
      modulesCreated: created.moduleIds.length,
      modulesAdded: created.moduleIds.length,
      modulesRemoved: 0,
      lessonsAdded: created.lessonIds.length,
      lessonsRemoved: 0,
      lessonsByType: computeLessonsByType(course.modules),
      totalLessons: countLessons(course.modules),
      warnings,
    };

    await recordImport(
      adminClient,
      adminUserId,
      newCourseId,
      course,
      fileName,
      "incremental",
      summary,
    );
    await recordAudit(
      adminClient,
      adminUserId,
      newCourseId,
      course,
      fileName,
      "course_imported",
    );

    return { success: true, data: summary };
  } catch (e) {
    if (createdCourseId) {
      await adminClient.from("courses").delete().eq("id", createdCourseId);
    }
    throw e;
  }
}

// ============================================================
// INCREMENTAL RE-IMPORT
//
// - Preserves every existing course/module/lesson
// - Matches modules by source_chapter_num within the course
// - Matches lessons by source_fingerprint (global unique source key)
// - Adds only missing modules/lessons
// ============================================================

async function doIncrementalImport(
  adminClient: SupabaseClient,
  adminUserId: string,
  courseId: string,
  course: ParsedCourse,
  warnings: ImportWarning[],
  fileName: string,
): Promise<ActionResult<ImportResult>> {
  const { modules } = course;

  const { data: existingModules, error: modFetchError } = await adminClient
    .from("modules")
    .select("id, source_chapter_num")
    .eq("course_id", courseId);

  if (modFetchError) {
    throw new Error(`Failed to fetch modules: ${modFetchError.message}`);
  }
  const existingModulesData = existingModules ?? [];

  const moduleIdByChapter = new Map<string, string>();
  for (const mod of existingModulesData) {
    if (mod.source_chapter_num) {
      moduleIdByChapter.set(mod.source_chapter_num, mod.id);
    }
  }

  const existingModuleIds = existingModulesData.map((m) => m.id);
  const lessonIdByFingerprint = new Map<string, string>();
  if (existingModuleIds.length > 0) {
    const { data: lessons, error: lessonFetchError } = await adminClient
      .from("lessons")
      .select("id, source_fingerprint")
      .in("module_id", existingModuleIds);

    if (lessonFetchError) {
      throw new Error(`Failed to fetch lessons: ${lessonFetchError.message}`);
    }
    for (const lesson of lessons ?? []) {
      if (lesson.source_fingerprint) {
        lessonIdByFingerprint.set(lesson.source_fingerprint, lesson.id);
      }
    }
  }

  const createdModuleIds: string[] = [];
  const createdLessonIds: string[] = [];
  let modulesAdded = 0;
  let lessonsAdded = 0;

  try {
    for (const mod of modules) {
        let moduleId = moduleIdByChapter.get(mod.source_chapter_num);

        if (!moduleId) {
          const { data: newModule, error: newModuleError } = await adminClient
            .from("modules")
            .insert({
              course_id: courseId,
              title: mod.title.trim(),
              description: mod.description?.trim() ?? null,
              sort_order: mod.sort_order,
              source_chapter_num: mod.source_chapter_num,
            })
            .select("id")
            .single();

          if (newModuleError) {
            throw new Error(`Failed to create module "${mod.title}": ${newModuleError.message}`);
          }
          const createdModuleId = newModule?.id;
          if (!createdModuleId) throw new Error("Module create returned null for " + mod.title);
          moduleId = createdModuleId;
          createdModuleIds.push(createdModuleId);
          moduleIdByChapter.set(mod.source_chapter_num, createdModuleId);
          modulesAdded++;
        }

        const finalModuleId = moduleId;
        for (const lesson of mod.lessons) {
          if (lessonIdByFingerprint.has(lesson.source_fingerprint)) continue;

          const { data: newLesson, error: newLessonError } = await adminClient
            .from("lessons")
            .insert({
              module_id: finalModuleId,
              title: lesson.title.trim(),
              description: lesson.description?.trim() ?? null,
              content_type: lesson.content_type,
              content: lesson.content,
              sort_order: lesson.sort_order,
              is_preview: lesson.is_preview,
              source_fingerprint: lesson.source_fingerprint,
              external_source: lesson.external_source,
              external_key: lesson.external_key,
              external_bh_url: lesson.external_bh_url,
              file_size: lesson.file_size,
              source_stamped: lesson.source_stamped,
            })
            .select("id")
            .single();

          if (newLessonError) {
            // Duplicate source material already imported — skip + warn
            // instead of aborting the whole run (H2).
            if (isSourceFingerprintConflict(newLessonError)) {
              warnings.push(fingerprintSkipWarning(lesson));
              continue;
            }
            throw new Error(`Failed to create lesson "${lesson.title}": ${newLessonError.message}`);
          }
          createdLessonIds.push(newLesson.id);
          lessonIdByFingerprint.set(lesson.source_fingerprint, newLesson.id);
          lessonsAdded++;
        }
      }

    const summary: ImportResult = {
      mode: "incremental",
      courseId,
      courseTitle: course.title,
      sourceCourseId: course.source_id,
      sourceType: course.source_type,
      modulesCreated: 0,
      modulesAdded,
      modulesRemoved: 0,
      lessonsAdded,
      lessonsRemoved: 0,
      lessonsByType: computeLessonsByType(modules),
      totalLessons: countLessons(modules),
      warnings,
    };

    await recordImport(
      adminClient,
      adminUserId,
      courseId,
      course,
      fileName,
      "incremental",
      summary,
    );
    await recordAudit(
      adminClient,
      adminUserId,
      courseId,
      course,
      fileName,
      "course_reimported",
    );

    return { success: true, data: summary };
  } catch (e) {
    if (createdLessonIds.length > 0) {
      await adminClient.from("lessons").delete().in("id", createdLessonIds);
    }
    if (createdModuleIds.length > 0) {
      await adminClient.from("modules").delete().in("id", createdModuleIds);
    }
    throw e;
  }
}

// ============================================================
// REPLACEMENT RE-IMPORT
//
// - Preserves the course row, ID, access, enrollments, and manual data
// - Preserves student lesson progress by re-linking it to recreated
//   lessons via source fingerprints (H1)
// - Deletes obsolete imported lessons (source_fingerprint NOT NULL)
// - Deletes obsolete imported modules (source_chapter_num NOT NULL)
// - Recreates source modules/lessons from the new DB
// - Manual lessons attached to imported modules keep the module alive
//   so manual CMS rows are never deleted
// ============================================================

interface ExistingModuleSnapshot {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  source_chapter_num: string | null;
}

interface ExistingLessonSnapshot {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  content_type: string;
  content: string | null;
  sort_order: number;
  is_preview: boolean;
  source_fingerprint: string | null;
  external_source: string | null;
  external_key: string | null;
  external_bh_url: string | null;
  file_size: number | null;
  source_stamped: boolean | null;
}

async function doReplacementImport(
  adminClient: SupabaseClient,
  adminUserId: string,
  courseId: string,
  course: ParsedCourse,
  warnings: ImportWarning[],
  fileName: string,
): Promise<ActionResult<ImportResult>> {
  const { data: allModules, error: modFetchError } = await adminClient
    .from("modules")
    .select("id, title, description, sort_order, source_chapter_num")
    .eq("course_id", courseId);

  if (modFetchError) {
    throw new Error(`Failed to fetch modules: ${modFetchError.message}`);
  }

  const allModulesData: ExistingModuleSnapshot[] = (allModules ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    sort_order: m.sort_order,
    source_chapter_num: m.source_chapter_num ?? null,
  }));

  const importedModules = allModulesData.filter((m) => m.source_chapter_num !== null);
  const importedModuleIds = importedModules.map((m) => m.id);

  const allLessons: ExistingLessonSnapshot[] = [];
  if (allModulesData.length > 0) {
    const { data: lessons, error: lessonFetchError } = await adminClient
      .from("lessons")
      .select(
        "id, module_id, title, description, content_type, content, sort_order, is_preview, source_fingerprint, external_source, external_key, external_bh_url, file_size, source_stamped",
      )
      .in("module_id", allModulesData.map((m) => m.id));

    if (lessonFetchError) {
      throw new Error(`Failed to fetch lessons: ${lessonFetchError.message}`);
    }
    allLessons.push(...(lessons ?? []));
  }

  const importedLessonIds: string[] = [];
  const importedLessonsByModule = new Map<string, ExistingLessonSnapshot[]>();
  for (const lesson of allLessons) {
    if (lesson.source_fingerprint && importedModuleIds.includes(lesson.module_id)) {
      importedLessonIds.push(lesson.id);
      const list = importedLessonsByModule.get(lesson.module_id) ?? [];
      list.push(lesson);
      importedLessonsByModule.set(lesson.module_id, list);
    }
  }

  const manualLessonModuleIds = new Set<string>();
  for (const lesson of allLessons) {
    if (!lesson.source_fingerprint) {
      manualLessonModuleIds.add(lesson.module_id);
    }
  }

  const modulesToDelete = importedModules.filter(
    (m) => !manualLessonModuleIds.has(m.id),
  );

  // ── Progress preservation (H1) ─────────────────────────────
  // Imported lessons are recreated with NEW UUIDs, and
  // lesson_progress.lesson_id is ON DELETE CASCADE — without this
  // snapshot every completion/resume record for imported lessons
  // would be destroyed. Fingerprint gives us the old→new mapping.
  const fingerprintByOldLessonId = new Map<string, string>();
  for (const lesson of allLessons) {
    if (lesson.source_fingerprint && importedModuleIds.includes(lesson.module_id)) {
      fingerprintByOldLessonId.set(lesson.id, lesson.source_fingerprint);
    }
  }

  interface ProgressSnapshotRow {
    user_id: string;
    lesson_id: string;
    completed: boolean;
    progress_percentage: number;
    last_position: number;
    updated_at: string;
  }

  let progressSnapshot: ProgressSnapshotRow[] = [];
  if (importedLessonIds.length > 0) {
    const { data: progressRows, error: progressFetchError } = await adminClient
      .from("lesson_progress")
      .select(
        "user_id, lesson_id, completed, progress_percentage, last_position, updated_at",
      )
      .in("lesson_id", importedLessonIds);

    if (progressFetchError) {
      throw new Error(`Failed to fetch lesson progress: ${progressFetchError.message}`);
    }
    progressSnapshot = (progressRows ?? []) as ProgressSnapshotRow[];
  }

  const createdModuleIds: string[] = [];
  const createdLessonIds: string[] = [];
  const newLessonIdByFingerprint = new Map<string, string>();
  let modulesAdded = 0;
  let lessonsAdded = 0;

  try {
    // Delete obsolete imported lessons first so manual lessons are never part
    // of a module cascade delete.
    if (importedLessonIds.length > 0) {
      await adminClient.from("lessons").delete().in("id", importedLessonIds);
    }

    // Delete obsolete imported modules unless a manual lesson prevents it.
    if (modulesToDelete.length > 0) {
      await adminClient
        .from("modules")
        .delete()
        .in("id", modulesToDelete.map((m) => m.id));
    }

    // Index remaining modules by source chapter. These are imported modules
    // kept alive only because they contain manual lessons.
    const keptModuleByChapter = new Map<string, string>();
    for (const m of importedModules) {
      if (m.source_chapter_num && !modulesToDelete.some((d) => d.id === m.id)) {
        keptModuleByChapter.set(m.source_chapter_num, m.id);
      }
    }

    // Rebuild source modules/lessons.
    for (const mod of course.modules) {
      let moduleId = keptModuleByChapter.get(mod.source_chapter_num);

      if (!moduleId) {
        const { data: newModule, error: newModuleError } = await adminClient
          .from("modules")
          .insert({
            course_id: courseId,
            title: mod.title.trim(),
            description: mod.description?.trim() ?? null,
            sort_order: mod.sort_order,
            source_chapter_num: mod.source_chapter_num,
          })
          .select("id")
          .single();

        if (newModuleError) {
          throw new Error(`Failed to create module "${mod.title}": ${newModuleError.message}`);
        }
        const repModuleId = newModule?.id;
        if (!repModuleId) throw new Error("Module create returned null for " + mod.title);
        moduleId = repModuleId;
        createdModuleIds.push(repModuleId);
        modulesAdded++;
      }

      const finalModuleId = moduleId;
      for (const lesson of mod.lessons) {
        const { data: newLesson, error: newLessonError } = await adminClient
          .from("lessons")
          .insert({
            module_id: finalModuleId,
            title: lesson.title.trim(),
            description: lesson.description?.trim() ?? null,
            content_type: lesson.content_type,
            content: lesson.content,
            sort_order: lesson.sort_order,
            is_preview: lesson.is_preview,
            source_fingerprint: lesson.source_fingerprint,
            external_source: lesson.external_source,
            external_key: lesson.external_key,
            external_bh_url: lesson.external_bh_url,
            file_size: lesson.file_size,
            source_stamped: lesson.source_stamped,
          })
          .select("id")
          .single();

        if (newLessonError) {
          // Duplicate source material already imported — skip + warn
          // instead of aborting the whole run (H2).
          if (isSourceFingerprintConflict(newLessonError)) {
            warnings.push(fingerprintSkipWarning(lesson));
            continue;
          }
          throw new Error(`Failed to create lesson "${lesson.title}": ${newLessonError.message}`);
        }
        createdLessonIds.push(newLesson.id);
        newLessonIdByFingerprint.set(lesson.source_fingerprint, newLesson.id);
        lessonsAdded++;
      }
    }

    // ── Restore progress onto the recreated lessons (H1) ───────
    // Dedupe by (user_id, new lesson id): two old lessons can map to
    // one new id via shared fingerprints; merge by OR-completion and
    // max percentage/position. Chunked upserts avoid per-row RPCs.
    const mergedByKey = new Map<
      string,
      {
        user_id: string;
        lesson_id: string;
        completed: boolean;
        progress_percentage: number;
        last_position: number;
      }
    >();
    for (const row of progressSnapshot) {
      const fingerprint = fingerprintByOldLessonId.get(row.lesson_id);
      if (!fingerprint) continue;
      const newLessonId = newLessonIdByFingerprint.get(fingerprint);
      if (!newLessonId) continue;

      const key = `${row.user_id}:${newLessonId}`;
      const existing = mergedByKey.get(key);
      if (existing) {
        existing.completed = existing.completed || row.completed;
        existing.progress_percentage = Math.max(
          existing.progress_percentage,
          row.progress_percentage,
        );
        existing.last_position = Math.max(existing.last_position, row.last_position);
      } else {
        mergedByKey.set(key, {
          user_id: row.user_id,
          lesson_id: newLessonId,
          completed: row.completed,
          progress_percentage: row.progress_percentage,
          last_position: row.last_position,
        });
      }
    }

    const restoreRows = [...mergedByKey.values()].map((r) => ({
      ...r,
      updated_at: new Date().toISOString(),
    }));
    let progressRestored = 0;
    for (let i = 0; i < restoreRows.length; i += 500) {
      const chunk = restoreRows.slice(i, i + 500);
      const { error: restoreError } = await adminClient
        .from("lesson_progress")
        .upsert(chunk, { onConflict: "user_id,lesson_id" });
      if (restoreError) {
        throw new Error(`Failed to restore student progress: ${restoreError.message}`);
      }
      progressRestored += chunk.length;
    }

    const modulesRemoved = modulesToDelete.length;
    const lessonsRemoved = importedLessonIds.length;

    const summary: ImportResult = {
      mode: "replacement",
      courseId,
      courseTitle: course.title,
      sourceCourseId: course.source_id,
      sourceType: course.source_type,
      modulesCreated: modulesAdded,
      modulesAdded,
      modulesRemoved,
      lessonsAdded,
      lessonsRemoved,
      lessonsByType: computeLessonsByType(course.modules),
      totalLessons: countLessons(course.modules),
      progressRestored,
      warnings,
    };

    await recordImport(
      adminClient,
      adminUserId,
      courseId,
      course,
      fileName,
      "replacement",
      summary,
    );
    await recordAudit(
      adminClient,
      adminUserId,
      courseId,
      course,
      fileName,
      "course_replaced",
    );

    return { success: true, data: summary };
  } catch (e) {
    // Rollback: remove partially-created re-import data, then restore the
    // exact IDs/rows that were replaced.
    if (createdLessonIds.length > 0) {
      await adminClient.from("lessons").delete().in("id", createdLessonIds);
    }
    if (createdModuleIds.length > 0) {
      await adminClient.from("modules").delete().in("id", createdModuleIds);
    }
    for (const mod of modulesToDelete) {
      await adminClient.from("modules").insert({
        id: mod.id,
        course_id: courseId,
        title: mod.title,
        description: mod.description,
        sort_order: mod.sort_order,
        source_chapter_num: mod.source_chapter_num,
      });
    }
    for (const lesson of [...importedLessonsByModule.values()].flat()) {
      await adminClient.from("lessons").insert({
        id: lesson.id,
        module_id: lesson.module_id,
        title: lesson.title,
        description: lesson.description,
        content_type: lesson.content_type,
        content: lesson.content,
        sort_order: lesson.sort_order,
        is_preview: lesson.is_preview,
        source_fingerprint: lesson.source_fingerprint,
        external_source: lesson.external_source,
        external_key: lesson.external_key,
        external_bh_url: lesson.external_bh_url,
        file_size: lesson.file_size,
        source_stamped: lesson.source_stamped,
      });
    }
    // Restore progress rows that were cascade-deleted with the lessons.
    if (progressSnapshot.length > 0) {
      for (let i = 0; i < progressSnapshot.length; i += 500) {
        await adminClient
          .from("lesson_progress")
          .upsert(progressSnapshot.slice(i, i + 500), {
            onConflict: "user_id,lesson_id",
          });
      }
    }
    throw e;
  }
}

// ============================================================
// SHARED HELPERS
// ============================================================

interface CreatedImportData {
  moduleIds: string[];
  lessonIds: string[];
}

const FINGERPRINT_UNIQUE_CONSTRAINT = "lessons_source_fingerprint_unique";

/**
 * True when an insert failed only because another lesson already owns
 * the same source_fingerprint (duplicate source material). These are
 * skipped with a warning instead of aborting the whole import (H2).
 */
function isSourceFingerprintConflict(error: {
  code?: string | null;
  message?: string | null;
}): boolean {
  return (
    error?.code === "23505" &&
    !!error.message &&
    error.message.includes(FINGERPRINT_UNIQUE_CONSTRAINT)
  );
}

function fingerprintSkipWarning(
  lesson: ParsedLesson,
): ImportWarning {
  const sourceType: ImportWarning["source_type"] =
    lesson.content_type === "video"
      ? "video"
      : lesson.content_type === "pdf"
        ? "pdf"
        : "code_file";
  return {
    level: "warning",
    message: `Skipped "${lesson.title.trim()}" — a lesson with this source fingerprint already exists.`,
    source_type: sourceType,
    source_key: lesson.source_fingerprint,
  };
}

async function createModules(
  adminClient: SupabaseClient,
  courseId: string,
  modules: ParsedModule[],
  warnings: ImportWarning[],
): Promise<CreatedImportData> {
  const moduleIds: string[] = [];
  const lessonIds: string[] = [];

  for (const mod of modules) {
    const { data: newModule, error: moduleError } = await adminClient
      .from("modules")
      .insert({
        course_id: courseId,
        title: mod.title.trim(),
        description: mod.description?.trim() ?? null,
        sort_order: mod.sort_order,
        source_chapter_num: mod.source_chapter_num,
      })
      .select("id")
      .single();

    if (moduleError) {
      throw new Error(`Failed to create module "${mod.title}": ${moduleError.message}`);
    }
    moduleIds.push(newModule.id);

    for (const lesson of mod.lessons) {
      const inserted = await insertLesson(adminClient, newModule.id, lesson, warnings);
      if (inserted) lessonIds.push(inserted);
    }
  }

  return { moduleIds, lessonIds };
}

/**
 * Insert an imported lesson. Returns the new lesson id, or null when the
 * row was skipped because its source fingerprint already exists
 * (duplicate source material — reported as a warning, never fatal).
 */
async function insertLesson(
  adminClient: SupabaseClient,
  moduleId: string,
  lesson: ParsedLesson,
  warnings: ImportWarning[],
): Promise<string | null> {
  const { data: newLesson, error: lessonError } = await adminClient
    .from("lessons")
    .insert({
      module_id: moduleId,
      title: lesson.title.trim(),
      description: lesson.description?.trim() ?? null,
      content_type: lesson.content_type,
      content: lesson.content,
      sort_order: lesson.sort_order,
      is_preview: lesson.is_preview,
      source_fingerprint: lesson.source_fingerprint,
      external_source: lesson.external_source,
      external_key: lesson.external_key,
      external_bh_url: lesson.external_bh_url,
      file_size: lesson.file_size,
      source_stamped: lesson.source_stamped,
    })
    .select("id")
    .single();

  if (lessonError) {
    if (isSourceFingerprintConflict(lessonError)) {
      warnings.push(fingerprintSkipWarning(lesson));
      return null;
    }
    throw new Error(`Failed to create lesson "${lesson.title}": ${lessonError.message}`);
  }
  return newLesson.id;
}

function countLessons(modules: ParsedModule[]): number {
  return modules.reduce((sum, mod) => sum + mod.lessons.length, 0);
}

function computeLessonsByType(
  modules: ParsedModule[],
): Record<string, number> {
  const byType: Record<string, number> = {};
  for (const mod of modules) {
    for (const lesson of mod.lessons) {
      byType[lesson.content_type] = (byType[lesson.content_type] || 0) + 1;
    }
  }
  return byType;
}

async function recordImport(
  adminClient: SupabaseClient,
  adminUserId: string,
  courseId: string,
  course: ParsedCourse,
  fileName: string,
  mode: "incremental" | "replacement",
  summary: ImportResult,
): Promise<void> {
  const { error } = await adminClient.from("course_imports").insert({
    course_id: courseId,
    mode,
    source_course_id: course.source_id,
    source_file_name: fileName,
    created_by: adminUserId,
    summary,
  });

  if (error) {
    throw new Error(`Failed to record import: ${error.message}`);
  }
}

async function recordAudit(
  adminClient: SupabaseClient,
  adminUserId: string,
  courseId: string,
  course: ParsedCourse,
  fileName: string,
  action: "course_imported" | "course_reimported" | "course_replaced",
): Promise<void> {
  await adminClient.from("audit_logs").insert({
    admin_id: adminUserId,
    action,
    entity_type: "courses",
    entity_id: courseId,
    metadata: {
      source_id: course.source_id,
      source_type: course.source_type,
      modules: course.modules.length,
      lessons: countLessons(course.modules),
      file_name: fileName,
    },
  });
}

// ============================================================
// SERVER ACTION (admin-authenticated entry point)
// ============================================================

/**
 * Import a .db course file. Admin-only.
 * Accepts FormData with a "file" field containing the .db file and an
 * optional "mode" field: "incremental" (default) or "replacement".
 */
type ParsedCourseForParse = {
  source_id: string;
  source_type: string;
  title: string;
  description: string | null;
  modules: {
    title: string;
    description: string | null;
    sort_order: number;
    source_chapter_num: string;
    lessons: {
      title: string;
      content_type: string;
      sort_order: number;
      is_preview: boolean;
    }[];
  }[];
};

export type ParseResultForClient = {
  success: true;
  course: ParsedCourseForParse;
  warnings: ImportWarning[];
  moduleCount: number;
  totalLessonCount: number;
  lessonsByType: Record<string, number>;
} | {
  success: false;
  error: string;
};

// ============================================================
// PARSE-ONLY (inspection step, no DB writes)
// ============================================================

export async function parseImport(
  formData: FormData,
): Promise<ActionResult<ParseResultForClient>> {
  try {
    await getAdminUser();

    const file = formData.get("file") as File | null;
    if (!file || !file.name.endsWith(".db")) {
      return { success: false, error: "Please provide a .db file." };
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    const parseResult = await parseDb(buffer);

    if (!parseResult.success) {
      return { success: false, error: parseResult.error };
    }

    const course = parseResult.course;
    const lessonsByType: Record<string, number> = {};
    let totalLessonCount = 0;
    for (const mod of course.modules) {
      for (const lesson of mod.lessons) {
        lessonsByType[lesson.content_type] = (lessonsByType[lesson.content_type] || 0) + 1;
        totalLessonCount++;
      }
    }

    return {
      success: true,
      data: {
        success: true,
        course: {
          source_id: course.source_id,
          source_type: course.source_type,
          title: course.title,
          description: course.description,
          modules: course.modules.map((mod) => ({
            title: mod.title,
            description: mod.description,
            sort_order: mod.sort_order,
            source_chapter_num: mod.source_chapter_num,
            lessons: mod.lessons.map((lesson) => ({
              title: lesson.title,
              content_type: lesson.content_type,
              sort_order: lesson.sort_order,
              is_preview: lesson.is_preview,
            })),
          })),
        },
        warnings: parseResult.warnings,
        moduleCount: course.modules.length,
        totalLessonCount,
        lessonsByType,
      },
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: message };
  }
}

// ============================================================
// IMPORT COURSE (server action, auth-protected)
// ============================================================

export async function importCourse(
  formData: FormData,
): Promise<ActionResult<ImportResult>> {
  try {
    const { user } = await getAdminUser();
    const adminClient = createAdminClient();

    const file = formData.get("file") as File | null;
    if (!file || !file.name.endsWith(".db")) {
      return { success: false, error: "Please provide a .db file." };
    }

    const modeValue = formData.get("mode");
    const mode =
      modeValue === "replacement" || modeValue === "incremental"
        ? modeValue
        : "incremental";

    const buffer = new Uint8Array(await file.arrayBuffer());
    const result = await executeImport(
      adminClient,
      user.id,
      buffer,
      file.name,
      mode,
    );
    if (result.success) {
      revalidatePath("/admin/courses");
    }
    return result;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: message };
  }
}