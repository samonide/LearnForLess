"use server";

import { getAdminUser } from "@/actions/admin/users";
import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";

type AdminRole = "admin" | "student";

// ============================================================
// GET ADMIN ACCOUNTS
// ============================================================

export async function getAdmins() {
  try {
    await getAdminUser();
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from("profiles")
      .select("id, email, display_name, username, created_at, updated_at")
      .eq("role", "admin")
      .order("created_at", { ascending: true });

    if (error) return { success: false as const, error: error.message };
    return { success: true as const, data: data ?? [] };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ============================================================
// SEARCH STUDENTS (for promotion)
// ============================================================

export async function searchPromotableUsers(query: string) {
  try {
    await getAdminUser();
    const adminClient = createAdminClient();
    const q = query.trim();

    if (!q) return { success: true as const, data: [] as { id: string; email: string | null; display_name: string | null; username: string | null }[] };

    const { data, error } = await adminClient
      .from("profiles")
      .select("id, email, display_name, username")
      .eq("role", "student")
      .or(`email.ilike.%${q}%,display_name.ilike.%${q}%,username.ilike.%${q}%`)
      .limit(8);

    if (error) return { success: false as const, error: error.message };
    return { success: true as const, data: data ?? [] };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ============================================================
// PROMOTE / DEMOTE ADMIN ROLE
// ============================================================

export async function updateAdminRole(
  userId: string,
  newRole: AdminRole
): Promise<ActionResult<void>> {
  try {
    const { user } = await getAdminUser();
    const adminClient = createAdminClient();

    const { data: target, error: targetError } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .single();

    if (targetError || !target) {
      return { success: false, error: "User not found." };
    }
    if (target.role === newRole) {
      return { success: true, data: undefined };
    }

    // Never allow demoting the last usable administrator.
    if (newRole === "student") {
      const { count } = await adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");

      if ((count ?? 0) <= 1) {
        return {
          success: false,
          error: "Cannot demote the last administrator. Promote another user to admin first.",
        };
      }
    }

    const { error: updateError } = await adminClient
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    await adminClient.from("audit_logs").insert({
      admin_id: user.id,
      action: newRole === "admin" ? "admin_promoted" : "admin_demoted",
      entity_type: "profiles",
      entity_id: userId,
      metadata: { role: newRole },
    });

    revalidatePath("/admin/admins");
    revalidatePath("/admin/users");
    return { success: true, data: undefined };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
