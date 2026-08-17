"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { buildStudentTokenLoginEmail, hashToken } from "@/lib/utils";
import type { TokenRedemptionError, TokenRedemptionResult } from "@/types";
import { redirect } from "next/navigation";

async function getStudentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { user, supabase };
}

// ============================================================
// REDEEM ACCESS TOKEN (authenticated — current user)
// ============================================================
//
// For an already-logged-in student: validates the token, then
// delegates to the redeem_access_token RPC which handles binding,
// course assignment, and profile upsert atomically.

export async function redeemTokenAuthenticated(
  rawToken: string
): Promise<TokenRedemptionResult> {
  try {
    const { user } = await getStudentUser();
    const adminClient = createAdminClient();

    const normalizedToken = rawToken.trim().toUpperCase();
    if (!normalizedToken || normalizedToken.length < 8) {
      return { success: false, error: "invalid_token" };
    }

    const tokenHash = await hashToken(normalizedToken);

    // Quick pre-check before RPC call
    const { data: token, error: tokenError } = await adminClient
      .from("access_tokens")
      .select("id, is_active, expires_at")
      .eq("token_hash", tokenHash)
      .single();

    if (tokenError || !token) {
      return { success: false, error: "invalid_token" };
    }

    if (!token.is_active) {
      return { success: false, error: "token_disabled" };
    }

    if (token.expires_at && new Date(token.expires_at).getTime() < Date.now()) {
      return { success: false, error: "token_expired" };
    }

    // RPC handles binding, course assignment, profile upsert, row locking
    const { data, error } = await adminClient.rpc("redeem_access_token", {
      p_token_hash: tokenHash,
      p_user_id: user.id,
    });

    if (error) {
      return { success: false, error: "unknown_error" };
    }

    const result = data as {
      success: boolean;
      error?: string;
      token_id?: string;
      course_ids?: string[];
    };

    if (!result.success) {
      return {
        success: false,
        error: (result.error as TokenRedemptionError) ?? "unknown_error",
      };
    }

    return {
      success: true,
      courseIds: result.course_ids ?? [],
    };
  } catch (e) {
    return { success: false, error: "unknown_error" };
  }
}

// ============================================================
// REDEEM ACCESS TOKEN (legacy — creates new auth user)
// ============================================================

export async function redeemToken(
  rawToken: string
): Promise<TokenRedemptionResult> {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Validate input
  const normalizedToken = rawToken.trim().toUpperCase();
  if (!normalizedToken || normalizedToken.length < 8) {
    return { success: false, error: "invalid_token" };
  }

  // Hash the token for DB lookup
  const tokenHash = await hashToken(normalizedToken);

  const { data: token, error: tokenError } = await adminClient
    .from("access_tokens")
    .select("id, is_active, expires_at, bound_user_id")
    .eq("token_hash", tokenHash)
    .single();

  if (tokenError || !token) {
    return { success: false, error: "invalid_token" };
  }

  if (!token.is_active) {
    return { success: false, error: "token_disabled" };
  }

  if (token.expires_at && new Date(token.expires_at).getTime() < Date.now()) {
    return { success: false, error: "token_expired" };
  }

  let boundUserId = token.bound_user_id;

  if (!boundUserId) {
    const loginEmail = buildStudentTokenLoginEmail(token.id);
    const { data: createdUser, error: createAuthError } = await adminClient.auth.admin.createUser({
      email: loginEmail,
      password: normalizedToken,
      email_confirm: true,
      user_metadata: { role: "student" },
    });

    if (createAuthError || !createdUser.user) {
      return { success: false, error: "unknown_error" };
    }

    boundUserId = createdUser.user.id;
    await adminClient
      .from("access_tokens")
      .update({ bound_user_id: boundUserId, max_uses: 1 })
      .eq("id", token.id);
  }

  // Ensure previous anonymous session is cleared before credential sign-in.
  await supabase.auth.signOut();

  const loginEmail = buildStudentTokenLoginEmail(token.id);
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: loginEmail,
    password: normalizedToken,
  });

  if (signInError || !signInData.user) {
    return { success: false, error: "invalid_token" };
  }

  const signedInUserId = signInData.user.id;

  const { data, error } = await adminClient.rpc("redeem_access_token", {
    p_token_hash: tokenHash,
    p_user_id: signedInUserId,
  });

  if (error) {
    console.error("[redeemToken] RPC error:", error.message);
    return { success: false, error: "unknown_error" };
  }

  const result = data as {
    success: boolean;
    error?: string;
    token_id?: string;
    course_ids?: string[];
  };

  if (!result.success) {
    return {
      success: false,
      error: (result.error as TokenRedemptionResult extends { success: false } ? typeof result.error : never) ?? "invalid_token",
    };
  }

  return {
    success: true,
    courseIds: result.course_ids ?? [],
  };
}

// ============================================================
// LOGOUT
// ============================================================

export async function logoutStudent() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/access");
}
