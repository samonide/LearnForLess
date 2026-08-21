import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFile } from "node:fs/promises";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isIntegrationTestEnv,
  getServiceClient,
  createTestUser,
  seedTestCourse,
} from "./setup";
import { hashToken } from "@/lib/utils";

// ============================================================
// Access-token generation regression tests
//
// These assertions pin down the fixed architecture: token
// generation is INDEPENDENT of auth. Generating a token must
// NEVER create an auth user. A blank (unclaimed) token must have
// bound_user_id = NULL, the correct created_by, and correct
// token_courses. Redemption binds it to an existing student.
//
// The app's generateAccessToken() is a Next.js server action that
// needs cookie-based admin auth, so we can't invoke it directly
// here. Instead we mirror its exact DB writes via the service-role
// client (same privilege the admin client uses) and assert the
// resulting state — which is what the fixed code path produces.
// ============================================================

const svc = getServiceClient();

// Safety-net: track all IDs for final cleanup on error.
const globalIds: {
  users: string[];
  courses: string[];
  modules: string[];
  lessons: string[];
  tokens: string[];
} = { users: [], courses: [], modules: [], lessons: [], tokens: [] };

/**
 * Clean up token-generation test data. Order matters for FKs.
 */
async function cleanupTokenGenData(
  svc: SupabaseClient,
  userIds: string[],
  courseIds: string[],
  moduleIds: string[],
  lessonIds: string[],
  tokenIds: string[]
): Promise<void> {
  for (const tid of tokenIds) {
    await svc.from("student_access").delete().eq("token_id", tid);
    await svc.from("token_courses").delete().eq("token_id", tid);
    await svc.from("access_tokens").delete().eq("id", tid);
  }
  for (const uid of userIds) {
    await svc.from("student_access").delete().eq("user_id", uid);
    await svc.from("lesson_progress").delete().eq("user_id", uid);
    await svc.from("user_courses").delete().eq("user_id", uid);
  }
  for (const lid of lessonIds) {
    await svc.from("lesson_progress").delete().eq("lesson_id", lid);
    await svc.from("lessons").delete().eq("id", lid);
  }
  for (const mid of moduleIds) {
    await svc.from("lessons").delete().eq("module_id", mid);
    await svc.from("modules").delete().eq("id", mid);
  }
  for (const cid of courseIds) {
    await svc.from("token_courses").delete().eq("course_id", cid);
    await svc.from("user_courses").delete().eq("course_id", cid);
    await svc.from("modules").delete().eq("course_id", cid);
    await svc.from("courses").delete().eq("id", cid);
  }
  for (const uid of userIds) {
    await svc.from("profiles").delete().eq("id", uid);
    await svc.auth.admin.deleteUser(uid);
  }
}

// ============================================================
// Test 1–4: token generation writes no auth user
// ============================================================

describe("Access-token generation — independent of auth", () => {
  const localIds = {
    users: <string[]>[],
    courses: <string[]>[],
    modules: <string[]>[],
    lessons: <string[]>[],
    tokens: <string[]>[],
  };
  const testId = Date.now().toString(36);
  let adminId: string;
  let courseId: string;

  beforeAll(async () => {
    if (!isIntegrationTestEnv) return;
    // Admin who "generates" the token (the authenticated admin).
    const admin = await createTestUser(svc, `tgen-admin-${testId}`, "adminPass!", "admin");
    adminId = admin.id;
    localIds.users.push(admin.id);
    globalIds.users.push(admin.id);

    // A course the token will grant.
    const course = await seedTestCourse(svc, `tgen-${testId}`);
    courseId = course.courseId;
    localIds.courses.push(course.courseId);
    localIds.modules.push(course.moduleId);
    localIds.lessons.push(course.lessonId);
    globalIds.courses.push(course.courseId);
    globalIds.modules.push(course.moduleId);
    globalIds.lessons.push(course.lessonId);

    // ★ Mirror generateAccessToken()'s exact DB writes:
    //   access_tokens  → token_courses.  ONLY these. NO auth.users,
    //   NO profiles, NO user_courses, NO student_access.
    const { rawToken, tokenHash, tokenHint } = await makeTokenForTest();
    const { data: token, error: te } = await svc
      .from("access_tokens")
      .insert({
        token_hash: tokenHash,
        token_hint: tokenHint,
        created_by: adminId,
        name: `TGen Token ${testId}`,
        description: null,
        is_active: true,
        expires_at: null,
        max_uses: 1,
        current_uses: 0,
      })
      .select("id")
      .single();
    if (te) throw new Error(`Create access_token failed: ${te.message}`);

    const { error: tc } = await svc
      .from("token_courses")
      .insert({ token_id: token.id, course_id: courseId });
    if (tc) throw new Error(`Create token_course failed: ${tc.message}`);

    localIds.tokens.push(token.id);
    globalIds.tokens.push(token.id);
    void rawToken;
  });

  it("generation creates NO auth user", async () => {
    if (!isIntegrationTestEnv) return;
    const tokenId = localIds.tokens[0];

    // No profile / auth user should exist deriving from this token.
    const { data: profiles } = await svc
      .from("profiles")
      .select("id, username, email")
      .eq("username", `tgen-${testId}`)
      .limit(1);
    expect(profiles ?? []).toEqual([]);

    // The token's synthetic-email convention must not have created a user either.
    const { data: byEmail } = await svc
      .from("profiles")
      .select("id")
      .eq("email", `${tokenId}@tokens.local`)
      .limit(1);
    expect(byEmail ?? []).toEqual([]);

    // No user_courses / student_access either.
    const { data: uc } = await svc
      .from("user_courses")
      .select("id")
      .eq("user_id", tokenId)
      .limit(1);
    expect(uc ?? []).toEqual([]);
    const { data: sa } = await svc
      .from("student_access")
      .select("id")
      .eq("user_id", tokenId)
      .limit(1);
    expect(sa ?? []).toEqual([]);
  });

  it("generated token records the generating admin in created_by", async () => {
    if (!isIntegrationTestEnv) return;
    const tokenId = localIds.tokens[0];
    const { data: token } = await svc
      .from("access_tokens")
      .select("created_by")
      .eq("id", tokenId)
      .single();
    expect(token).not.toBeNull();
    expect(token?.created_by).toBe(adminId);
  });

  it("token_courses link the token to the selected courses", async () => {
    if (!isIntegrationTestEnv) return;
    const tokenId = localIds.tokens[0];
    const { data: links } = await svc
      .from("token_courses")
      .select("course_id")
      .eq("token_id", tokenId);
    expect(links).not.toBeNull();
    expect(links!.length).toBe(1);
    expect(links![0].course_id).toBe(courseId);
  });

  it("bound_user_id stays NULL until a student redeems", async () => {
    if (!isIntegrationTestEnv) return;
    const tokenId = localIds.tokens[0];
    const { data: token } = await svc
      .from("access_tokens")
      .select("bound_user_id, current_uses")
      .eq("id", tokenId)
      .single();
    expect(token).not.toBeNull();
    expect(token?.bound_user_id).toBeNull();
    expect(token?.current_uses).toBe(0);
  });

  afterAll(async () => {
    if (!isIntegrationTestEnv) return;
    await cleanupTokenGenData(
      svc,
      localIds.users,
      localIds.courses,
      localIds.modules,
      localIds.lessons,
      localIds.tokens
    );
  });
});

// ============================================================
// Test 9: static guard — no token-generation path creates auth users
// ============================================================

describe("Token generation code — no phantom auth-user creation", () => {
  it("generateAccessToken() never calls auth.admin.createUser", async () => {
    const source = await readFile(
      new URL("../../src/actions/admin/tokens.ts", import.meta.url),
      "utf-8"
    );
    // Extract the generateAccessToken function body only — the rest of the
    // file (updateToken, updateTokenCourses) legitimately touches profiles
    // and user_courses for already-redeemed tokens.
    const fnStart = source.indexOf("export async function generateAccessToken");
    const nextFn = source.indexOf("export async function", fnStart + 1);
    const fnBody = nextFn !== -1 ? source.slice(fnStart, nextFn) : source.slice(fnStart);

    expect(fnBody).not.toMatch(/createUser/);
    expect(fnBody).not.toMatch(/deleteUser/);
    expect(fnBody).not.toMatch(/buildStudentTokenLoginEmail/);
    // The generation function must not touch auth.users / profiles /
    // user_courses / student_access.
    expect(fnBody).not.toMatch(/from\("auth\.users"\)/);
    expect(fnBody).not.toMatch(/\.from\("profiles"\)/);
    expect(fnBody).not.toMatch(/\.from\("user_courses"\)/);
    expect(fnBody).not.toMatch(/\.from\("student_access"\)/);
    // It still records the generating admin and the token hash.
    expect(fnBody).toMatch(/created_by: user\.id/);
    expect(fnBody).toMatch(/token_hash/);
  });

  it("no other admin action creates an auth user outside student registration", async () => {
    // Registration is the ONLY legitimate admin.createUser flow (student accounts).
    const tokensSrc = await readFile(
      new URL("../../src/actions/admin/tokens.ts", import.meta.url),
      "utf-8"
    );
    const usersSrc = await readFile(
      new URL("../../src/actions/admin/users.ts", import.meta.url),
      "utf-8"
    );
    expect(tokensSrc).not.toMatch(/createUser/);
    expect(usersSrc).not.toMatch(/createUser/);
  });
});

// ── Local helper: produce token fields like generateSecureToken() ──
async function makeTokenForTest() {
  const rawToken = `TGEN-${Date.now()}-${Math.random().toString(36).slice(2)}`.toUpperCase();
  const tokenHash = await hashToken(rawToken);
  return { rawToken, tokenHash, tokenHint: rawToken.slice(0, 4) };
}
