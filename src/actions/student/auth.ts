"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// ============================================================
// STUDENT USERNAME/PASSWORD AUTH
// ============================================================
//
// Supabase Auth requires an email + password. We map each username to a
// synthetic email address derived from the username, so a student signs in
// with a stable identity without exposing any email to them.
//
// A username must be unique (see the partial unique index on
// profiles.username, migration 003). To detect collisions atomically we
// reserve the profile row first under a transaction-like upsert guarded by
// the unique index, then create the matching auth user.

async function buildStudentLoginEmail(username: string): Promise<string> {
  // Lowercase, strip anything outside [a-z0-9_-]
  const normalized = username
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "");
  return `student-${normalized}@learnforless.local`;
}

export type StudentAuthResult =
  | { success: true }
  | { success: false; error: StudentAuthError };

export type StudentAuthError =
  | "username_taken"
  | "username_invalid"
  | "password_too_short"
  | "invalid_credentials"
  | "unknown_error";

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function isValidUsername(username: string): boolean {
  // 3-30 chars, letters/digits/underscore/dash
  return /^[A-Za-z0-9_-]{3,30}$/.test(username);
}

// ============================================================
// REGISTER
// ============================================================

export async function registerStudent(
  username: string,
  password: string
): Promise<StudentAuthResult> {
  const normalized = normalizeUsername(username);

  if (!isValidUsername(normalized)) {
    return { success: false, error: "username_invalid" };
  }

  if (password.length < 8) {
    return { success: false, error: "password_too_short" };
  }

  const adminClient = createAdminClient();

  // Reserve the username. Insert first so the unique index catches
  // collisions atomically. We use a placeholder auth id and update it after
  // creating the auth user — but a placeholder violates the FK to auth.users.
  // Instead, create the auth user first (its email is derived from the
  // username, which is unique), then upsert the profile. If the profile
  // upsert conflicts, we roll back by deleting the just-created auth user.
  const loginEmail = await buildStudentLoginEmail(normalized);

  const { data: created, error: createError } =
    await adminClient.auth.admin.createUser({
      email: loginEmail,
      password,
      email_confirm: true,
      user_metadata: { role: "student" },
    });

  if (createError || !created.user) {
    // User already exists in auth (e.g. a previous register/sign-in) —
    // distinguish from a genuine collision via the profiles table.
    const { data: existing } = await adminClient
      .from("profiles")
      .select("id")
      .eq("username", normalized)
      .maybeSingle();

    if (existing) {
      return { success: false, error: "username_taken" };
    }

    return { success: false, error: "unknown_error" };
  }

  const userId = created.user.id;

  // Upsert profile with username. ON CONFLICT on username signals a race.
  const { error: profileError } = await adminClient.from("profiles").upsert(
    {
      id: userId,
      username: normalized,
      display_name: normalized,
      role: "student",
    },
    { onConflict: "id" }
  );

  if (profileError) {
    // Clean up the auth user we just created to avoid orphaned account.
    await adminClient.auth.admin.deleteUser(userId);
    return { success: false, error: "username_taken" };
  }

  return { success: true };
}

// ============================================================
// LOGIN
// ============================================================

export async function loginStudent(
  username: string,
  password: string
): Promise<StudentAuthResult> {
  const normalized = normalizeUsername(username);

  if (!isValidUsername(normalized)) {
    return { success: false, error: "invalid_credentials" };
  }

  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Resolve username -> profile id via admin client (RLS lets any authed
  // user read profiles, but a fresh login has no session yet).
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id")
    .eq("username", normalized)
    .maybeSingle();

  if (!profile) {
    return { success: false, error: "invalid_credentials" };
  }

  const loginEmail = await buildStudentLoginEmail(normalized);

  // Clear any prior anonymous session before credential sign-in.
  await supabase.auth.signOut();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: loginEmail,
    password,
  });

  if (error || !data.user) {
    return { success: false, error: "invalid_credentials" };
  }

  // The auth user id must match the reserved profile for this username.
  if (data.user.id !== profile.id) {
    await supabase.auth.signOut();
    return { success: false, error: "invalid_credentials" };
  }

  return { success: true };
}

// ============================================================
// LOGOUT
// ============================================================

export async function logoutStudent() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
