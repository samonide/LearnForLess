"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { generateSlug } from "@/lib/utils";
import type {
  ActionResult,
  CreateCourseInput,
  UpdateCourseInput,
  CourseStatus,
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
// CREATE COURSE
// ============================================================

export async function createCourse(
  input: CreateCourseInput
): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const { user, supabase } = await getAdminUser();
    const adminClient = createAdminClient();

    const slug = input.slug || generateSlug(input.title);

    // Check for duplicate course title (case-insensitive)
    const { data: dupTitle } = await adminClient
      .from("courses")
      .select("id")
      .ilike("title", input.title.trim())
      .limit(1)
      .maybeSingle();

    if (dupTitle) {
      return { success: false, error: "A course with this title already exists." };
    }

    const { data, error } = await adminClient
      .from("courses")
      .insert({
        title: input.title.trim(),
        slug,
        description: input.description?.trim() ?? null,
        thumbnail_url: input.thumbnail_url ?? null,
        status: input.status ?? "draft",
      })
      .select("id, slug")
      .single();

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: "A course with this slug already exists." };
      }
      return { success: false, error: error.message };
    }

    // Audit log
    await adminClient.from("audit_logs").insert({
      admin_id: user.id,
      action: "course_created",
      entity_type: "courses",
      entity_id: data.id,
      metadata: { title: input.title, slug },
    });

    revalidatePath("/admin/courses");
    return { success: true, data: { id: data.id, slug: data.slug } };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: message };
  }
}

// ============================================================
// UPDATE COURSE
// ============================================================

export async function updateCourse(
  input: UpdateCourseInput
): Promise<ActionResult<void>> {
  try {
    const { user } = await getAdminUser();
    const adminClient = createAdminClient();

    const { id, ...rest } = input;
    const updates: Record<string, unknown> = {};
    if (rest.title !== undefined) updates.title = rest.title.trim();
    if (rest.slug !== undefined) updates.slug = rest.slug;
    if (rest.description !== undefined) updates.description = rest.description?.trim() ?? null;
    if (rest.thumbnail_url !== undefined) updates.thumbnail_url = rest.thumbnail_url ?? null;
    if (rest.status !== undefined) updates.status = rest.status;

    // Check for duplicate course title (case-insensitive, exclude current)
    if (rest.title !== undefined) {
      const { data: dup } = await adminClient
        .from("courses")
        .select("id")
        .ilike("title", rest.title.trim())
        .neq("id", id)
        .limit(1)
        .maybeSingle();
      if (dup) {
        return { success: false, error: "A course with this title already exists." };
      }
    }

    const { error } = await adminClient
      .from("courses")
      .update(updates)
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    await adminClient.from("audit_logs").insert({
      admin_id: user.id,
      action: "course_updated",
      entity_type: "courses",
      entity_id: id,
      metadata: updates,
    });

    revalidatePath("/admin/courses");
    revalidatePath(`/admin/courses/${id}`);
    return { success: true, data: undefined };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: message };
  }
}

// ============================================================
// DELETE COURSE
// ============================================================

export async function deleteCourse(id: string): Promise<ActionResult<void>> {
  try {
    const { user } = await getAdminUser();
    const adminClient = createAdminClient();

    const { data: course } = await adminClient
      .from("courses")
      .select("title")
      .eq("id", id)
      .single();

    const { error } = await adminClient.from("courses").delete().eq("id", id);
    if (error) return { success: false, error: error.message };

    await adminClient.from("audit_logs").insert({
      admin_id: user.id,
      action: "course_deleted",
      entity_type: "courses",
      entity_id: id,
      metadata: { title: course?.title },
    });

    revalidatePath("/admin/courses");
    return { success: true, data: undefined };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: message };
  }
}

// ============================================================
// SET COURSE STATUS (publish / unpublish / archive)
// ============================================================

export async function setCourseStatus(
  id: string,
  status: CourseStatus
): Promise<ActionResult<void>> {
  try {
    const { user } = await getAdminUser();
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from("courses")
      .update({ status })
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    const action =
      status === "published"
        ? "course_published"
        : status === "archived"
        ? "course_archived"
        : "course_unpublished";

    await adminClient.from("audit_logs").insert({
      admin_id: user.id,
      action,
      entity_type: "courses",
      entity_id: id,
      metadata: { status },
    });

    revalidatePath("/admin/courses");
    revalidatePath(`/admin/courses/${id}`);
    return { success: true, data: undefined };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: message };
  }
}

// ============================================================
// UPLOAD COURSE THUMBNAIL
// ============================================================

const THUMBNAIL_BUCKET = "course-thumbnails";

/**
 * Extract the object path from a public URL of the thumbnails bucket.
 * Returns null for external URLs or unparseable values.
 */
function thumbnailPathFromUrl(url: string): string | null {
  const marker = `/object/public/${THUMBNAIL_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const rawPath = url.slice(idx + marker.length).split("?")[0];
  if (!rawPath || rawPath.includes("/") || rawPath.includes("..")) return null;
  return decodeURIComponent(rawPath);
}

export async function uploadCourseThumbnail(
  courseId: string,
  file: File
): Promise<ActionResult<{ url: string }>> {
  try {
    await getAdminUser();
    const adminClient = createAdminClient();

    if (!file.type.startsWith("image/")) {
      return { success: false, error: "Only image files are allowed." };
    }

    const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
    if (!/^[a-z0-9]{1,8}$/.test(ext)) {
      return { success: false, error: "Invalid image file extension." };
    }

    const path = `${courseId}.${ext}`;

    const { data: existing } = await adminClient
      .from("courses")
      .select("thumbnail_url")
      .eq("id", courseId)
      .single();

    const previousPath = existing?.thumbnail_url
      ? thumbnailPathFromUrl(existing.thumbnail_url)
      : null;

    // Upload into the dedicated PUBLIC bucket — getPublicUrl output is
    // only usable when the object lives in a public bucket (C3).
    const { error } = await adminClient.storage
      .from(THUMBNAIL_BUCKET)
      .upload(path, file, { upsert: true });

    if (error) return { success: false, error: error.message };

    const { data: urlData } = adminClient.storage
      .from(THUMBNAIL_BUCKET)
      .getPublicUrl(path);

    // Update course thumbnail_url
    await adminClient
      .from("courses")
      .update({ thumbnail_url: urlData.publicUrl })
      .eq("id", courseId);

    // Remove stale object when the extension changed (e.g. png → webp)
    if (previousPath && previousPath !== path) {
      await adminClient.storage.from(THUMBNAIL_BUCKET).remove([previousPath]);
    }

    revalidatePath(`/admin/courses/${courseId}`);
    return { success: true, data: { url: urlData.publicUrl } };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: message };
  }
}
