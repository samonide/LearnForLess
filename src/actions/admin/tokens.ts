"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { buildStudentTokenLoginEmail, generateSecureToken } from "@/lib/utils";
import type { ActionResult, GenerateTokenInput } from "@/types";
import { revalidatePath } from "next/cache";

async function getAdminUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, id")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") throw new Error("Forbidden");
  return { user, supabase };
}

// ============================================================
// GENERATE ACCESS TOKEN
// Returns the raw token ONCE — never stored
// ============================================================

export async function generateAccessToken(
  input: GenerateTokenInput
): Promise<ActionResult<{ rawToken: string; tokenId: string }>> {
  try {
    const { user } = await getAdminUser();
    const adminClient = createAdminClient();

    if (input.course_ids.length === 0) {
      return { success: false, error: "At least one course must be selected." };
    }

    // Generate cryptographically secure token
    const { rawToken, tokenHash, tokenHint } = await generateSecureToken();

    const trimmedName = input.name.trim();

    if (!trimmedName) {
      return { success: false, error: "Student account name is required." };
    }

    // Insert token record (only hash stored — NEVER raw token)
    const { data: token, error: tokenError } = await adminClient
      .from("access_tokens")
      .insert({
        token_hash: tokenHash,
        token_hint: tokenHint,
        created_by: user.id,
        name: trimmedName,
        description: input.description?.trim() ?? null,
        is_active: true,
        expires_at: input.expires_at ?? null,
        max_uses: 1,
        current_uses: 0,
      })
      .select("id")
      .single();

    if (tokenError) return { success: false, error: tokenError.message };

    const loginEmail = buildStudentTokenLoginEmail(token.id);

    const { data: studentAuth, error: createAuthError } = await adminClient.auth.admin.createUser({
      email: loginEmail,
      password: rawToken,
      email_confirm: true,
      user_metadata: {
        display_name: trimmedName,
        role: "student",
      },
    });

    if (createAuthError || !studentAuth.user) {
      await adminClient.from("access_tokens").delete().eq("id", token.id);
      return { success: false, error: createAuthError?.message ?? "Failed to create student account." };
    }

    const studentId = studentAuth.user.id;

    const { error: bindError } = await adminClient
      .from("access_tokens")
      .update({ bound_user_id: studentId })
      .eq("id", token.id);

    if (bindError) {
      await adminClient.auth.admin.deleteUser(studentId);
      await adminClient.from("access_tokens").delete().eq("id", token.id);
      return { success: false, error: bindError.message };
    }

    await adminClient
      .from("profiles")
      .update({
        display_name: trimmedName,
        role: "student",
        email: null,
      })
      .eq("id", studentId);

    // Link courses to this token
    const tokenCourses = input.course_ids.map((courseId) => ({
      token_id: token.id,
      course_id: courseId,
    }));

    const { error: coursesError } = await adminClient
      .from("token_courses")
      .insert(tokenCourses);

    if (coursesError) {
      // Rollback: delete the token
      await adminClient.auth.admin.deleteUser(studentId);
      await adminClient.from("access_tokens").delete().eq("id", token.id);
      return { success: false, error: coursesError.message };
    }

    await adminClient.from("user_courses").insert(
      input.course_ids.map((courseId) => ({
        user_id: studentId,
        course_id: courseId,
        granted_by_token: token.id,
      }))
    );

    await adminClient
      .from("student_access")
      .upsert(
        {
          user_id: studentId,
          token_id: token.id,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "token_id" }
      );

    // Audit log — do NOT log rawToken or tokenHash
    await adminClient.from("audit_logs").insert({
      admin_id: user.id,
      action: "token_created",
      entity_type: "access_tokens",
      entity_id: token.id,
      metadata: {
        name: input.name,
        student_user_id: studentId,
        course_count: input.course_ids.length,
        has_expiry: !!input.expires_at,
        has_max_uses: true,
      },
    });

    revalidatePath("/admin/tokens");
    return {
      success: true,
      data: { rawToken, tokenId: token.id },
    };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ============================================================
// DISABLE TOKEN
// ============================================================

export async function disableToken(id: string): Promise<ActionResult<void>> {
  try {
    const { user } = await getAdminUser();
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from("access_tokens")
      .update({ is_active: false })
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    await adminClient.from("audit_logs").insert({
      admin_id: user.id,
      action: "token_disabled",
      entity_type: "access_tokens",
      entity_id: id,
      metadata: {},
    });

    revalidatePath("/admin/tokens");
    return { success: true, data: undefined };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ============================================================
// ENABLE TOKEN
// ============================================================

export async function enableToken(id: string): Promise<ActionResult<void>> {
  try {
    const { user } = await getAdminUser();
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from("access_tokens")
      .update({ is_active: true })
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    await adminClient.from("audit_logs").insert({
      admin_id: user.id,
      action: "token_enabled",
      entity_type: "access_tokens",
      entity_id: id,
      metadata: {},
    });

    revalidatePath("/admin/tokens");
    return { success: true, data: undefined };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ============================================================
// DELETE TOKEN
// ============================================================

export async function deleteToken(id: string): Promise<ActionResult<void>> {
  try {
    const { user } = await getAdminUser();
    const adminClient = createAdminClient();

    const { data: token } = await adminClient
      .from("access_tokens")
      .select("name")
      .eq("id", id)
      .single();

    const { error } = await adminClient
      .from("access_tokens")
      .delete()
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    await adminClient.from("audit_logs").insert({
      admin_id: user.id,
      action: "token_deleted",
      entity_type: "access_tokens",
      entity_id: id,
      metadata: { name: token?.name },
    });

    revalidatePath("/admin/tokens");
    return { success: true, data: undefined };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ============================================================
// UPDATE TOKEN COURSES
// ============================================================

export async function updateTokenCourses(
  tokenId: string,
  courseIds: string[]
): Promise<ActionResult<void>> {
  try {
    const { user } = await getAdminUser();
    const adminClient = createAdminClient();

    // Delete existing links
    await adminClient
      .from("token_courses")
      .delete()
      .eq("token_id", tokenId);

    if (courseIds.length > 0) {
      await adminClient.from("token_courses").insert(
        courseIds.map((courseId) => ({ token_id: tokenId, course_id: courseId }))
      );
    }

    const { data: token } = await adminClient
      .from("access_tokens")
      .select("bound_user_id")
      .eq("id", tokenId)
      .single();

    if (token?.bound_user_id) {
      const studentId = token.bound_user_id;

      await adminClient
        .from("user_courses")
        .delete()
        .eq("user_id", studentId)
        .eq("granted_by_token", tokenId);

      if (courseIds.length > 0) {
        await adminClient.from("user_courses").upsert(
          courseIds.map((courseId) => ({
            user_id: studentId,
            course_id: courseId,
            granted_by_token: tokenId,
          })),
          { onConflict: "user_id,course_id" }
        );
      }
    }

    await adminClient.from("audit_logs").insert({
      admin_id: user.id,
      action: "token_courses_updated",
      entity_type: "access_tokens",
      entity_id: tokenId,
      metadata: { course_count: courseIds.length },
    });

    revalidatePath("/admin/tokens");
    return { success: true, data: undefined };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ============================================================
// UPDATE TOKEN METADATA
// ============================================================

export async function updateToken(
  id: string,
  updates: {
    name?: string;
    description?: string;
    expires_at?: string | null;
    max_uses?: number | null;
  }
): Promise<ActionResult<void>> {
  try {
    await getAdminUser();
    const adminClient = createAdminClient();

    const { data: token } = await adminClient
      .from("access_tokens")
      .select("bound_user_id")
      .eq("id", id)
      .single();

    const { error } = await adminClient
      .from("access_tokens")
      .update({
        ...(updates.name && { name: updates.name.trim() }),
        ...(updates.description !== undefined && {
          description: updates.description?.trim() ?? null,
        }),
        ...(updates.expires_at !== undefined && { expires_at: updates.expires_at }),
        ...(updates.max_uses !== undefined && { max_uses: updates.max_uses }),
      })
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    if (token?.bound_user_id && updates.name?.trim()) {
      await adminClient
        .from("profiles")
        .update({ display_name: updates.name.trim(), email: null })
        .eq("id", token.bound_user_id);
    }

    revalidatePath("/admin/tokens");
    return { success: true, data: undefined };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ============================================================
// GET TOKENS (for admin — excludes token_hash)
// ============================================================

export async function getTokensWithCourses() {
  try {
    const { user } = await getAdminUser();
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from("access_tokens")
      .select(`
        id, token_hint, name, description, is_active, bound_user_id,
        expires_at, max_uses, current_uses, last_used_at,
        created_at, created_by,
        token_courses(
          course_id,
          courses(id, title, status)
        )
      `)
      .order("created_at", { ascending: false });

    if (error) return { success: false as const, error: error.message };
    return { success: true as const, data: data ?? [] };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function getTokenForEdit(tokenId: string) {
  try {
    await getAdminUser();
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from("access_tokens")
      .select(`
        id, name, description, is_active, token_hint,
        token_courses(course_id)
      `)
      .eq("id", tokenId)
      .single();

    if (error) return { success: false as const, error: error.message };
    return { success: true as const, data };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
