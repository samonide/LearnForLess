"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hashToken, generateRecoveryTokenString } from "@/lib/utils";
import type { RecoveryResult, GenerateRecoveryResult } from "@/types";

// ============================================================
// ADMIN: GENERATE RECOVERY TOKEN
// ============================================================

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

export async function generateRecoveryToken(
  username: string
): Promise<GenerateRecoveryResult> {
  try {
    const { user } = await getAdminUser();
    const adminClient = createAdminClient();

    const normalized = username.trim().toLowerCase();
    if (!normalized || normalized.length < 3) {
      return { success: false, error: "Invalid username." };
    }

    // Check that the username exists as a profile (do not reveal to caller)
    const { data: profile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("username", normalized)
      .maybeSingle();

    if (!profile) {
      // Return success silently so we don't reveal whether username exists
      return { success: true, rawToken: "XXXXXXXXXXXX", hint: "USER" };
    }

    // Generate a recovery token
    const rawToken = await generateRecoveryTokenString();
    const tokenHash = await hashToken(rawToken);

    // Token expires in 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error: insertError } = await adminClient
      .from("recovery_tokens")
      .insert({
        username: normalized,
        token_hash: tokenHash,
        expires_at: expiresAt,
        created_by: user.id,
      });

    if (insertError) {
      return { success: false, error: "Failed to create recovery token." };
    }

    return {
      success: true,
      rawToken,
      hint: normalized.slice(0, 4),
    };
  } catch (e) {
    return { success: false, error: "An unexpected error occurred." };
  }
}

// ============================================================
// STUDENT: RESET PASSWORD WITH RECOVERY TOKEN
// ============================================================

export async function resetPasswordWithRecoveryToken(
  username: string,
  recoveryToken: string,
  newPassword: string
): Promise<RecoveryResult> {
  const adminClient = createAdminClient();

  const normalized = username.trim().toLowerCase();

  if (!normalized || normalized.length < 3) {
    return { success: false, error: "invalid_recovery_credentials" };
  }

  if (newPassword.length < 8) {
    return { success: false, error: "password_too_short" };
  }

  // Hash the recovery token
  const tokenHash = await hashToken(recoveryToken.trim().toUpperCase());

  // Find the recovery token
  const { data: token } = await adminClient
    .from("recovery_tokens")
    .select("id, username, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .single();

  if (!token) {
    return { success: false, error: "invalid_recovery_credentials" };
  }

  // Verify username matches
  if (token.username !== normalized) {
    return { success: false, error: "invalid_recovery_credentials" };
  }

  // Check if already used
  if (token.used_at) {
    return { success: false, error: "recovery_token_used" };
  }

  // Check expiry
  if (new Date(token.expires_at).getTime() < Date.now()) {
    return { success: false, error: "recovery_token_expired" };
  }

  // Mark token as used (single-use)
  const { error: markError } = await adminClient
    .from("recovery_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", token.id)
    .is("used_at", null); // race guard

  if (markError) {
    return { success: false, error: "unknown_error" };
  }

  // Resolve username -> auth user
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id")
    .eq("username", normalized)
    .maybeSingle();

  if (!profile) {
    return { success: false, error: "invalid_recovery_credentials" };
  }

  // Reset the password via Supabase Auth admin API
  const { error: updateError } = await adminClient.auth.admin.updateUserById(
    profile.id,
    { password: newPassword }
  );

  if (updateError) {
    // Un-mark the token so it can be retried
    await adminClient
      .from("recovery_tokens")
      .update({ used_at: null })
      .eq("id", token.id);
    return { success: false, error: "unknown_error" };
  }

  return { success: true };
}