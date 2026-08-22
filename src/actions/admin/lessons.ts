"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { buildStoragePath } from "@/lib/utils";
import type { ActionResult, CreateLessonInput, UpdateLessonInput } from "@/types";
import { revalidatePath } from "next/cache";

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

async function getModuleCourseId(moduleId: string) {
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("modules")
    .select("course_id")
    .eq("id", moduleId)
    .single();
  return data?.course_id ?? null;
}

async function getLessonCourseId(lessonId: string) {
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("lessons")
    .select("module_id, modules(course_id)")
    .eq("id", lessonId)
    .single();

  const moduleData = (data as any)?.modules;
  if (Array.isArray(moduleData)) {
    return (moduleData[0] as { course_id?: string } | undefined)?.course_id ?? null;
  }

  return (moduleData as { course_id?: string } | null | undefined)?.course_id ?? null;
}

// ============================================================
// CREATE LESSON
// ============================================================

export async function createLesson(
  input: CreateLessonInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await getAdminUser();
    const adminClient = createAdminClient();

    // Check for duplicate lesson title within the same module
    const { data: existingTitle } = await adminClient
      .from("lessons")
      .select("id")
      .eq("module_id", input.module_id)
      .ilike("title", input.title.trim())
      .limit(1)
      .maybeSingle();

    if (existingTitle) {
      return {
        success: false,
        error: "A lesson with this title already exists in this module.",
      };
    }

    // Get max sort_order for this module
    const { data: existing } = await adminClient
      .from("lessons")
      .select("sort_order")
      .eq("module_id", input.module_id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();

    const sortOrder =
      input.sort_order ?? (existing ? existing.sort_order + 1 : 1);

    const { data, error } = await adminClient
      .from("lessons")
      .insert({
        module_id: input.module_id,
        title: input.title.trim(),
        description: input.description?.trim() ?? null,
        content_type: input.content_type ?? "text",
        content: input.content ?? null,
        sort_order: sortOrder,
        is_preview: input.is_preview ?? false,
      })
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };

    await adminClient.from("audit_logs").insert({
      admin_id: user.id,
      action: "lesson_created",
      entity_type: "lessons",
      entity_id: data.id,
      metadata: {
        module_id: input.module_id,
        title: input.title,
        content_type: input.content_type,
      },
    });

    const courseId = await getModuleCourseId(input.module_id);
    if (courseId) revalidatePath(`/admin/courses/${courseId}/builder`);
    return { success: true, data: { id: data.id } };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ============================================================
// UPDATE LESSON
// ============================================================

export async function updateLesson(
  input: UpdateLessonInput
): Promise<ActionResult<void>> {
  try {
    await getAdminUser();
    const adminClient = createAdminClient();

    const { id, ...rest } = input;
    const updates: Record<string, unknown> = {};
    if (rest.title !== undefined) updates.title = rest.title.trim();
    if (rest.description !== undefined) updates.description = rest.description?.trim() ?? null;
    if (rest.content_type !== undefined) updates.content_type = rest.content_type;
    if (rest.content !== undefined) updates.content = rest.content;
    if (rest.storage_path !== undefined) updates.storage_path = rest.storage_path;
    if (rest.is_preview !== undefined) updates.is_preview = rest.is_preview;
    if (rest.sort_order !== undefined) updates.sort_order = rest.sort_order;

    // Single row fetch reused below: duplicate-title scoping, stale-file
    // cleanup, and media-source validation all need the current state.
    const { data: existing } = await adminClient
      .from("lessons")
      .select(
        "module_id, title, content_type, content, storage_path, external_key, external_bh_url"
      )
      .eq("id", id)
      .single();

    if (!existing) {
      return { success: false, error: "Lesson not found." };
    }

    // Check for duplicate title within the same module (case-insensitive, exclude current)
    if (rest.title !== undefined) {
      const { data: dup } = await adminClient
        .from("lessons")
        .select("id")
        .eq("module_id", existing.module_id)
        .ilike("title", rest.title.trim())
        .neq("id", id)
        .limit(1)
        .maybeSingle();
      if (dup) {
        return { success: false, error: "A lesson with this title already exists in this module." };
      }
    }

    // M5 backstop: a media-type lesson must always keep at least one
    // source — uploaded file, stream/URL content, or importer fields.
    const MEDIA_TYPES = ["pdf", "video", "image", "file"];
    const finalType =
      (updates.content_type as string | undefined) ?? existing.content_type;
    if (MEDIA_TYPES.includes(finalType)) {
      const finalContent =
        "content" in updates ? updates.content : existing.content;
      const finalPath =
        "storage_path" in updates ? updates.storage_path : existing.storage_path;
      const hasExternalSource =
        !!existing.external_key || !!existing.external_bh_url;
      if (!finalContent && !finalPath && !hasExternalSource) {
        return {
          success: false,
          error:
            "Media lessons need a file or an imported source. Upload a file before saving.",
        };
      }
    }

    const { error } = await adminClient.from("lessons").update(updates).eq("id", id);
    if (error) return { success: false, error: error.message };

    // M6: when storage_path is explicitly cleared, delete the orphaned
    // storage object so private files don't linger unlinked.
    if (updates.storage_path === null && existing.storage_path) {
      await adminClient.storage
        .from("course-materials")
        .remove([existing.storage_path]);
    }

    const courseId = await getLessonCourseId(id);
    if (courseId) revalidatePath(`/admin/courses/${courseId}/builder`);
    return { success: true, data: undefined };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ============================================================
// DELETE LESSON
// ============================================================

export async function deleteLesson(id: string): Promise<ActionResult<void>> {
  try {
    const { user } = await getAdminUser();
    const adminClient = createAdminClient();

    const { data: lesson } = await adminClient
      .from("lessons")
      .select("title, module_id, storage_path")
      .eq("id", id)
      .single();

    // Delete storage file if exists
    if (lesson?.storage_path) {
      await adminClient.storage
        .from("course-materials")
        .remove([lesson.storage_path]);
    }

    const { error } = await adminClient.from("lessons").delete().eq("id", id);
    if (error) return { success: false, error: error.message };

    await adminClient.from("audit_logs").insert({
      admin_id: user.id,
      action: "lesson_deleted",
      entity_type: "lessons",
      entity_id: id,
      metadata: { title: lesson?.title },
    });

    if (lesson?.module_id) {
      const courseId = await getModuleCourseId(lesson.module_id);
      if (courseId) revalidatePath(`/admin/courses/${courseId}/builder`);
    }

    return { success: true, data: undefined };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ============================================================
// REORDER LESSONS
// ============================================================

export async function reorderLessons(
  moduleId: string,
  orderedIds: string[]
): Promise<ActionResult<void>> {
  try {
    await getAdminUser();
    const adminClient = createAdminClient();

    const updates = orderedIds.map((id, index) =>
      adminClient
        .from("lessons")
        .update({ sort_order: index + 1 })
        .eq("id", id)
        .eq("module_id", moduleId)
    );

    // Surface any failed update (H5) — never report success on partial failure
    const results = await Promise.all(updates);
    const firstError = results.find((r) => r.error);
    if (firstError?.error) {
      return { success: false, error: `Reorder failed: ${firstError.error.message}` };
    }

    const courseId = await getModuleCourseId(moduleId);
    if (courseId) revalidatePath(`/admin/courses/${courseId}/builder`);
    return { success: true, data: undefined };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ============================================================
// UPLOAD LESSON FILE
// ============================================================

export async function uploadLessonFile(
  courseId: string,
  moduleId: string,
  lessonId: string,
  formData: FormData
): Promise<ActionResult<{ storagePath: string; signedUrl: string }>> {
  try {
    await getAdminUser();
    const adminClient = createAdminClient();

    const file = formData.get("file") as File;
    if (!file || file.size === 0) {
      return { success: false, error: "No file provided" };
    }

    // Max 500MB
    if (file.size > 524288000) {
      return { success: false, error: "File too large (max 500MB)" };
    }

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = buildStoragePath(courseId, moduleId, lessonId, sanitizedName);

    // Remember the old object but do NOT delete it yet (H4): if this
    // upload fails the existing file must stay intact.
    const { data: existingLesson } = await adminClient
      .from("lessons")
      .select("storage_path")
      .eq("id", lessonId)
      .single();

    // Upload first
    const { error: uploadError } = await adminClient.storage
      .from("course-materials")
      .upload(storagePath, file, { upsert: true });

    if (uploadError) return { success: false, error: uploadError.message };

    // Update lesson only after a successful upload
    await adminClient
      .from("lessons")
      .update({ storage_path: storagePath })
      .eq("id", lessonId);

    // Delete old object only after the replacement is stored and linked
    if (existingLesson?.storage_path && existingLesson.storage_path !== storagePath) {
      await adminClient.storage
        .from("course-materials")
        .remove([existingLesson.storage_path]);
    }

    // Create signed URL (1 hour for admin preview)
    const { data: signedUrlData, error: signedError } = await adminClient.storage
      .from("course-materials")
      .createSignedUrl(storagePath, 3600);

    if (signedError) return { success: false, error: signedError.message };

    revalidatePath(`/admin/courses/${courseId}/builder`);
    return {
      success: true,
      data: { storagePath, signedUrl: signedUrlData.signedUrl },
    };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ============================================================
// GET SIGNED URL FOR ADMIN PREVIEW
// ============================================================

export async function getAdminSignedUrl(
  storagePath: string
): Promise<ActionResult<{ url: string }>> {
  try {
    await getAdminUser();
    const adminClient = createAdminClient();

    const { data, error } = await adminClient.storage
      .from("course-materials")
      .createSignedUrl(storagePath, 3600);

    if (error) return { success: false, error: error.message };
    return { success: true, data: { url: data.signedUrl } };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
