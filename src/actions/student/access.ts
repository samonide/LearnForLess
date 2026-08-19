"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { hashToken } from "@/lib/utils";
import type { TokenRedemptionError, TokenRedemptionResult } from "@/types";

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
