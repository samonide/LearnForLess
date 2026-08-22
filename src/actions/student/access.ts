"use server";

import { createClient } from "@/lib/supabase/server";
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
    const { user, supabase } = await getStudentUser();

    const normalizedToken = rawToken.trim().toUpperCase();
    if (!normalizedToken || normalizedToken.length < 8) {
      return { success: false, error: "invalid_token" };
    }

    const tokenHash = await hashToken(normalizedToken);

    // RPC requires an authenticated caller whose session matches
    // p_user_id (auth.uid() guard inside the function), so it must be
    // invoked with the student's own client — never the service role.
    // It handles binding, course assignment, and row locking.
    const { data, error } = await supabase.rpc("redeem_access_token", {
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

    // Fetch course names for the redeemed courses
    const courseIds = result.course_ids ?? [];
    let courseNames: string[] | undefined;
    if (courseIds.length > 0) {
      const { data: courses } = await supabase
        .from("courses")
        .select("title")
        .in("id", courseIds);
      courseNames = courses?.map((c) => c.title) ?? undefined;
    }

    return {
      success: true,
      courseIds,
      courseNames,
    };
  } catch (e) {
    return { success: false, error: "unknown_error" };
  }
}
