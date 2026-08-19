"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult, CreateModuleInput } from "@/types";

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
// CREATE MODULE
// ============================================================

export async function createModule(
  input: CreateModuleInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await getAdminUser();
    const adminClient = createAdminClient();

    // Check for duplicate module title within the same course
    const { data: existingTitle } = await adminClient
      .from("modules")
      .select("id")
      .eq("course_id", input.course_id)
      .ilike("title", input.title.trim())
      .limit(1)
      .maybeSingle();

    if (existingTitle) {
      return {
        success: false,
        error: "A module with this title already exists in this course.",
      };
    }

    // Get max sort_order for this course
    const { data: existing } = await adminClient
      .from("modules")
      .select("sort_order")
      .eq("course_id", input.course_id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();

    const sortOrder =
      input.sort_order ?? (existing ? existing.sort_order + 1 : 1);

    const { data, error } = await adminClient
      .from("modules")
      .insert({
        course_id: input.course_id,
        title: input.title.trim(),
        description: input.description?.trim() ?? null,
        sort_order: sortOrder,
      })
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };

    await adminClient.from("audit_logs").insert({
      admin_id: user.id,
      action: "module_created",
      entity_type: "modules",
      entity_id: data.id,
      metadata: { course_id: input.course_id, title: input.title },
    });

    revalidatePath(`/admin/courses/${input.course_id}/builder`);
    return { success: true, data: { id: data.id } };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ============================================================
// UPDATE MODULE
// ============================================================

export async function updateModule(
  id: string,
  updates: { title?: string; description?: string }
): Promise<ActionResult<void>> {
  try {
    await getAdminUser();
    const adminClient = createAdminClient();

    const { data: mod } = await adminClient
      .from("modules")
      .select("course_id")
      .eq("id", id)
      .single();

    if (!mod) return { success: false, error: "Module not found." };

    // Check for duplicate title within the same course (case-insensitive, exclude current)
    if (updates.title) {
      const { data: dup } = await adminClient
        .from("modules")
        .select("id")
        .eq("course_id", mod.course_id)
        .ilike("title", updates.title.trim())
        .neq("id", id)
        .limit(1)
        .maybeSingle();
      if (dup) {
        return { success: false, error: "A module with this title already exists in this course." };
      }
    }

    const { error } = await adminClient
      .from("modules")
      .update({
        ...(updates.title && { title: updates.title.trim() }),
        ...(updates.description !== undefined && {
          description: updates.description?.trim() ?? null,
        }),
      })
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    if (mod) revalidatePath(`/admin/courses/${mod.course_id}/builder`);
    return { success: true, data: undefined };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ============================================================
// DELETE MODULE
// ============================================================

export async function deleteModule(id: string): Promise<ActionResult<void>> {
  try {
    const { user } = await getAdminUser();
    const adminClient = createAdminClient();

    const { data: mod } = await adminClient
      .from("modules")
      .select("course_id, title")
      .eq("id", id)
      .single();

    const { error } = await adminClient.from("modules").delete().eq("id", id);
    if (error) return { success: false, error: error.message };

    await adminClient.from("audit_logs").insert({
      admin_id: user.id,
      action: "module_deleted",
      entity_type: "modules",
      entity_id: id,
      metadata: { title: mod?.title, course_id: mod?.course_id },
    });

    if (mod) revalidatePath(`/admin/courses/${mod.course_id}/builder`);
    return { success: true, data: undefined };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ============================================================
// REORDER MODULES
// Accepts an ordered array of module IDs
// ============================================================

export async function reorderModules(
  courseId: string,
  orderedIds: string[]
): Promise<ActionResult<void>> {
  try {
    await getAdminUser();
    const adminClient = createAdminClient();

    const updates = orderedIds.map((id, index) =>
      adminClient
        .from("modules")
        .update({ sort_order: index + 1 })
        .eq("id", id)
        .eq("course_id", courseId)
    );

    await Promise.all(updates);

    revalidatePath(`/admin/courses/${courseId}/builder`);
    return { success: true, data: undefined };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
