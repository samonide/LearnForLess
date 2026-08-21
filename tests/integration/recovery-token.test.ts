import { describe, it, expect, afterAll } from "vitest";
import { getServiceClient, createTestUser, cleanupTestData } from "./setup";
import { hashToken, generateRecoveryTokenString } from "@/lib/utils";
import { resetPasswordWithRecoveryToken } from "@/actions/student/recovery";

// ============================================================
// Recovery token flow — regression tests
// Covers the student-side action end-to-end against live
// Supabase. Admin-side generation is replicated via service
// client (identical DB writes to generateRecoveryToken).
// ============================================================

const svc = getServiceClient();
const runId = `${Date.now()}`;
const userIds: string[] = [];

async function seedRecoveryToken(username: string) {
  const rawToken = await generateRecoveryTokenString();
  const tokenHash = await hashToken(rawToken);
  const { error } = await svc.from("recovery_tokens").insert({
    username,
    token_hash: tokenHash,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
  expect(error).toBeNull();
  return rawToken;
}

async function signIn(email: string, password: string): Promise<boolean> {
  const { createClient } = await import("@supabase/supabase-js");
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { error } = await anon.auth.signInWithPassword({ email, password });
  return !error;
}

afterAll(async () => {
  for (const uid of userIds) {
    await svc.from("recovery_tokens").delete().eq("created_by", uid);
    await cleanupTestData(svc, [uid], []);
  }
});

describe("recovery token flow", () => {
  it("resets the password with a valid token", async () => {
    const id = `rt-ok-${runId}`;
    const user = await createTestUser(svc, id, "OldPassword123!", "student");
    userIds.push(user.id);

    const rawToken = await seedRecoveryToken(`test-${id}`);
    const result = await resetPasswordWithRecoveryToken(
      `test-${id}`,
      rawToken,
      "NewPassword456!"
    );
    expect(result.success).toBe(true);

    // Old password rejected, new password accepted.
    expect(await signIn(user.email, "OldPassword123!")).toBe(false);
    expect(await signIn(user.email, "NewPassword456!")).toBe(true);

    // Token consumed exactly once.
    const { data } = await svc
      .from("recovery_tokens")
      .select("used_at")
      .eq("token_hash", await hashToken(rawToken))
      .single();
    expect(data?.used_at).not.toBeNull();
  });

  it("rejects an unknown token without consuming valid state", async () => {
    const result = await resetPasswordWithRecoveryToken(
      `test-rt-bad-${runId}`,
      "ZZZZZZZZZZZZ",
      "NewPassword456!"
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe("invalid_recovery_credentials");
  });

  it("rejects reuse of an already-consumed token", async () => {
    const id = `rt-reuse-${runId}`;
    const user = await createTestUser(svc, id, "OldPassword123!", "student");
    userIds.push(user.id);

    const rawToken = await seedRecoveryToken(`test-${id}`);
    const first = await resetPasswordWithRecoveryToken(`test-${id}`, rawToken, "NewPassword456!");
    expect(first.success).toBe(true);

    const second = await resetPasswordWithRecoveryToken(`test-${id}`, rawToken, "AnotherPass789!");
    expect(second.success).toBe(false);
    if (second.success) return;
    expect(second.error).toBe("recovery_token_used");
  });

  it("rejects a token presented for a different username", async () => {
    const id = `rt-xu-${runId}`;
    const user = await createTestUser(svc, id, "OldPassword123!", "student");
    userIds.push(user.id);

    const rawToken = await seedRecoveryToken(`test-${id}`);
    const result = await resetPasswordWithRecoveryToken(
      `someonelse-${runId}`,
      rawToken,
      "NewPassword456!"
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe("invalid_recovery_credentials");

    // Token remains unconsumed after failed username match.
    const { data } = await svc
      .from("recovery_tokens")
      .select("used_at")
      .eq("token_hash", await hashToken(rawToken))
      .single();
    expect(data?.used_at).toBeNull();
  });

  it("rejects an expired token", async () => {
    const id = `rt-exp-${runId}`;
    const user = await createTestUser(svc, id, "OldPassword123!", "student");
    userIds.push(user.id);

    const rawToken = await generateRecoveryTokenString();
    const { error } = await svc.from("recovery_tokens").insert({
      username: `test-${id}`,
      token_hash: await hashToken(rawToken),
      expires_at: new Date(Date.now() - 60 * 1000).toISOString(),
    });
    expect(error).toBeNull();

    const result = await resetPasswordWithRecoveryToken(`test-${id}`, rawToken, "NewPassword456!");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe("recovery_token_expired");
  });
});
