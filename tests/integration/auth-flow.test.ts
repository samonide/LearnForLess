import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isIntegrationTestEnv,
  getServiceClient,
  createAuthedClient,
  createTestUser,
  seedTestCourse,
  type TestUser,
  type TestCourse,
} from "./setup";
import { hashToken } from "@/lib/utils";

const svc = getServiceClient();

// Safety-net: track all IDs across all tests for final cleanup on error.
const globalIds: {
  users: string[];
  courses: string[];
  modules: string[];
  lessons: string[];
  tokens: string[];
} = {
  users: [],
  courses: [],
  modules: [],
  lessons: [],
  tokens: [],
};

// ============================================================
// Helpers
// ============================================================

/**
 * Create a test token with a known raw value so we can call
 * redeem_access_token RPC with a verifiable hash.
 */
async function createTestToken(
  svc: SupabaseClient,
  name: string,
  courseIds: string[],
  adminUserId: string,
  options?: { is_active?: boolean; expires_at?: string | null }
): Promise<{ rawToken: string; tokenId: string }> {
  const rawToken = `TEST-TOKEN-${name}-${Date.now()}`.toUpperCase();
  const tokenHash = await hashToken(rawToken);
  const tokenHint = rawToken.slice(0, 4);

  const { data: token, error } = await svc
    .from("access_tokens")
    .insert({
      token_hash: tokenHash,
      token_hint: tokenHint,
      name,
      created_by: adminUserId,
      is_active: options?.is_active ?? true,
      expires_at: options?.expires_at ?? null,
      max_uses: 1,
      current_uses: 0,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Create token failed: ${error.message}`);

  if (courseIds.length > 0) {
    const { error: tcError } = await svc
      .from("token_courses")
      .insert(courseIds.map((cid) => ({ token_id: token.id, course_id: cid })));
    if (tcError) throw new Error(`Link token courses failed: ${tcError.message}`);
  }

  return { rawToken, tokenId: token.id };
}

/**
 * Remove all test data created during auth-flow tests.
 * Order matters because of FK constraints.
 */
async function cleanupAuthFlowData(
  svc: SupabaseClient,
  userIds: string[],
  courseIds: string[],
  moduleIds: string[],
  lessonIds: string[],
  tokenIds: string[]
): Promise<void> {
  // Token-dependent tables first
  for (const tid of tokenIds) {
    await svc.from("student_access").delete().eq("token_id", tid);
    await svc.from("token_courses").delete().eq("token_id", tid);
  }
  // User-dependent tables
  for (const uid of userIds) {
    await svc.from("student_access").delete().eq("user_id", uid);
    await svc.from("lesson_progress").delete().eq("user_id", uid);
    await svc.from("user_courses").delete().eq("user_id", uid);
  }
  // Tokens themselves
  for (const tid of tokenIds) {
    await svc.from("access_tokens").delete().eq("id", tid);
  }
  // Course data
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
  // Auth users (cascades to profiles)
  for (const uid of userIds) {
    await svc.from("profiles").delete().eq("id", uid);
    await svc.auth.admin.deleteUser(uid);
  }
}

// ============================================================
// Registration flow
// ============================================================

describe("Auth flow — registration", () => {
  const localIds = {
    users: <string[]>[],
    courses: <string[]>[],
    modules: <string[]>[],
    lessons: <string[]>[],
    tokens: <string[]>[],
  };
  const testId = Date.now().toString(36);
  let studentEmail: string;

  beforeAll(async () => {
    if (!isIntegrationTestEnv) return;
    studentEmail = `test-reg-flow-${testId}@learnforless.test`;

    // Step 1: Create auth user via Admin API (mimics registerStudent)
    const { data: userData, error } = await svc.auth.admin.createUser({
      email: studentEmail,
      password: "testPass123!",
      email_confirm: true,
      user_metadata: { role: "student" },
    });
    if (error) throw new Error(`Create user failed: ${error.message}`);
    const userId = userData.user!.id;
    localIds.users.push(userId);
    globalIds.users.push(userId);

    // Step 2: Upsert profile with username (mimics registerStudent)
    const { error: profileError } = await svc.from("profiles").upsert(
      {
        id: userId,
        email: studentEmail,
        username: `reg-flow-${testId}`,
        display_name: `reg-flow-${testId}`,
        role: "student",
      },
      { onConflict: "id" }
    );
    if (profileError)
      throw new Error(`Profile upsert failed: ${profileError.message}`);
  });

  it("creates a profile record for the registered user", async () => {
    if (!isIntegrationTestEnv) return;
    const userId = localIds.users[0];
    const { data: profile } = await svc
      .from("profiles")
      .select("id, username, role")
      .eq("id", userId)
      .single();
    expect(profile).not.toBeNull();
    expect(profile?.username).toBe(`reg-flow-${testId}`);
    expect(profile?.role).toBe("student");
  });

  it("student can sign in with the registered credentials", async () => {
    if (!isIntegrationTestEnv) return;
    const authedClient = await createAuthedClient(studentEmail, "testPass123!");
    const {
      data: { user },
    } = await authedClient.auth.getUser();
    expect(user).not.toBeNull();
    expect(user?.id).toBe(localIds.users[0]);
  });

  afterAll(async () => {
    if (!isIntegrationTestEnv) return;
    await cleanupAuthFlowData(
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
// Login flow
// ============================================================

describe("Auth flow — login", () => {
  const localIds = {
    users: <string[]>[],
    courses: <string[]>[],
    modules: <string[]>[],
    lessons: <string[]>[],
    tokens: <string[]>[],
  };
  const testId = Date.now().toString(36);
  let student: TestUser;

  beforeAll(async () => {
    if (!isIntegrationTestEnv) return;
    student = await createTestUser(
      svc,
      `login-${testId}`,
      "validPass123!",
      "student"
    );
    localIds.users.push(student.id);
    globalIds.users.push(student.id);
  });

  it("succeeds with valid credentials", async () => {
    if (!isIntegrationTestEnv) return;
    const authedClient = await createAuthedClient(
      student.email,
      "validPass123!"
    );
    const {
      data: { user },
    } = await authedClient.auth.getUser();
    expect(user).not.toBeNull();
    expect(user?.id).toBe(student.id);
  });

  it("rejects wrong password", async () => {
    if (!isIntegrationTestEnv) return;
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { error } = await client.auth.signInWithPassword({
      email: student.email,
      password: "wrongPassword!",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/Invalid login/i);
  });

  it("rejects nonexistent email", async () => {
    if (!isIntegrationTestEnv) return;
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { error } = await client.auth.signInWithPassword({
      email: `nonexistent-${testId}@learnforless.test`,
      password: "somePassword!",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/Invalid login/i);
  });

  it("session is active after login", async () => {
    if (!isIntegrationTestEnv) return;
    const authedClient = await createAuthedClient(
      student.email,
      "validPass123!"
    );
    const {
      data: { session },
    } = await authedClient.auth.getSession();
    expect(session).not.toBeNull();
    expect(session?.user?.id).toBe(student.id);
  });

  it("session is cleared after sign-out", async () => {
    if (!isIntegrationTestEnv) return;
    const authedClient = await createAuthedClient(
      student.email,
      "validPass123!"
    );
    // Sign out
    await authedClient.auth.signOut();
    // Session should be gone
    const {
      data: { session },
    } = await authedClient.auth.getSession();
    expect(session).toBeNull();
  });

  afterAll(async () => {
    if (!isIntegrationTestEnv) return;
    await cleanupAuthFlowData(
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
// Token redemption
// ============================================================

describe("Auth flow — token redemption", () => {
  // ── Valid token redemption ──────────────────────────────────

  describe("valid token", () => {
    const localIds = {
      users: <string[]>[],
      courses: <string[]>[],
      modules: <string[]>[],
      lessons: <string[]>[],
      tokens: <string[]>[],
    };
    const testId = Date.now().toString(36);
    let rawToken: string;
    let courseId: string;

    beforeAll(async () => {
      if (!isIntegrationTestEnv) return;
      // Create student
      const student = await createTestUser(
        svc,
        `redeem-${testId}`,
        "pass123!",
        "student"
      );
      localIds.users.push(student.id);
      globalIds.users.push(student.id);

      // Create admin for token creation
      const admin = await createTestUser(
        svc,
        `redeem-admin-${testId}`,
        "adminPass!",
        "admin"
      );
      localIds.users.push(admin.id);
      globalIds.users.push(admin.id);

      // Create published course
      const course = await seedTestCourse(svc, `redeem-${testId}`);
      courseId = course.courseId;
      localIds.courses.push(course.courseId);
      localIds.modules.push(course.moduleId);
      localIds.lessons.push(course.lessonId);
      globalIds.courses.push(course.courseId);
      globalIds.modules.push(course.moduleId);
      globalIds.lessons.push(course.lessonId);

      // Create token linked to the course
      const token = await createTestToken(
        svc,
        `redeem-${testId}`,
        [course.courseId],
        admin.id
      );
      rawToken = token.rawToken;
      localIds.tokens.push(token.tokenId);
      globalIds.tokens.push(token.tokenId);
    });

    it("redeems successfully and returns course_ids", async () => {
      if (!isIntegrationTestEnv) return;
      const tokenHash = await hashToken(rawToken);
      const { data, error } = await svc.rpc("redeem_access_token", {
        p_token_hash: tokenHash,
        p_user_id: localIds.users[0],
      });

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data.success).toBe(true);
      expect(data.course_ids).toBeDefined();
      expect(Array.isArray(data.course_ids)).toBe(true);
      expect(data.course_ids).toContain(courseId);
    });

    it("creates user_courses entries for the granted courses", async () => {
      if (!isIntegrationTestEnv) return;
      const { data: userCourses } = await svc
        .from("user_courses")
        .select("course_id, granted_by_token")
        .eq("user_id", localIds.users[0]);

      expect(userCourses).not.toBeNull();
      expect(userCourses!.length).toBeGreaterThanOrEqual(1);
      expect(userCourses!.map((uc: any) => uc.course_id)).toContain(courseId);
    });

    it("creates student_access record", async () => {
      if (!isIntegrationTestEnv) return;
      const { data: sa } = await svc
        .from("student_access")
        .select("user_id, token_id, last_seen_at")
        .eq("user_id", localIds.users[0])
        .maybeSingle();

      expect(sa).not.toBeNull();
      expect(sa?.user_id).toBe(localIds.users[0]);
      expect(sa?.token_id).toBe(localIds.tokens[0]);
      expect(sa?.last_seen_at).not.toBeNull();
    });

    it("increments token current_uses on first claim", async () => {
      if (!isIntegrationTestEnv) return;
      const { data: token } = await svc
        .from("access_tokens")
        .select("current_uses, bound_user_id")
        .eq("id", localIds.tokens[0])
        .single();

      expect(token).not.toBeNull();
      expect(token?.current_uses).toBe(1);
      expect(token?.bound_user_id).toBe(localIds.users[0]);
    });

    afterAll(async () => {
      if (!isIntegrationTestEnv) return;
      await cleanupAuthFlowData(
        svc,
        localIds.users,
        localIds.courses,
        localIds.modules,
        localIds.lessons,
        localIds.tokens
      );
    });
  });

  // ── Invalid token rejection ─────────────────────────────────

  describe("invalid token rejection", () => {
    const localIds = {
      users: <string[]>[],
      courses: <string[]>[],
      modules: <string[]>[],
      lessons: <string[]>[],
      tokens: <string[]>[],
    };
    const testId = Date.now().toString(36);

    beforeAll(async () => {
      if (!isIntegrationTestEnv) return;
      // Need an admin user to create tokens
      const admin = await createTestUser(
        svc,
        `admin-invalid-${testId}`,
        "adminPass!",
        "admin"
      );
      localIds.users.push(admin.id);
      globalIds.users.push(admin.id);
    });

    it("rejects nonexistent token hash", async () => {
      if (!isIntegrationTestEnv) return;
      const fakeHash = "a".repeat(64);
      const { data, error } = await svc.rpc("redeem_access_token", {
        p_token_hash: fakeHash,
        p_user_id: "00000000-0000-0000-0000-000000000000",
      });

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data.success).toBe(false);
      expect(data.error).toBe("invalid_token");
    });

    it("rejects disabled token", async () => {
      if (!isIntegrationTestEnv) return;
      const admin = localIds.users[0];
      const { rawToken, tokenId } = await createTestToken(
        svc,
        `disabled-${testId}`,
        [],
        admin,
        { is_active: false }
      );
      localIds.tokens.push(tokenId);
      globalIds.tokens.push(tokenId);

      const tokenHash = await hashToken(rawToken);
      const { data, error } = await svc.rpc("redeem_access_token", {
        p_token_hash: tokenHash,
        p_user_id: "00000000-0000-0000-0000-000000000000",
      });

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data.success).toBe(false);
      expect(data.error).toBe("token_disabled");
    });

    it("rejects expired token", async () => {
      if (!isIntegrationTestEnv) return;
      const admin = localIds.users[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString();
      const { rawToken, tokenId } = await createTestToken(
        svc,
        `expired-${testId}`,
        [],
        admin,
        { expires_at: yesterday }
      );
      localIds.tokens.push(tokenId);
      globalIds.tokens.push(tokenId);

      const tokenHash = await hashToken(rawToken);
      const { data, error } = await svc.rpc("redeem_access_token", {
        p_token_hash: tokenHash,
        p_user_id: "00000000-0000-0000-0000-000000000000",
      });

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data.success).toBe(false);
      expect(data.error).toBe("token_expired");
    });

    it("rejects token with no published courses linked", async () => {
      if (!isIntegrationTestEnv) return;
      const admin = localIds.users[0];
      const { rawToken, tokenId } = await createTestToken(
        svc,
        `no-courses-${testId}`,
        [],
        admin,
        { is_active: true }
      );
      localIds.tokens.push(tokenId);
      globalIds.tokens.push(tokenId);

      const tokenHash = await hashToken(rawToken);
      const { data, error } = await svc.rpc("redeem_access_token", {
        p_token_hash: tokenHash,
        p_user_id: localIds.users[0], // use a real user UUID
      });

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data.success).toBe(false);
      expect(data.error).toBe("no_courses_assigned");
    });

    afterAll(async () => {
      if (!isIntegrationTestEnv) return;
      await cleanupAuthFlowData(
        svc,
        localIds.users,
        localIds.courses,
        localIds.modules,
        localIds.lessons,
        localIds.tokens
      );
    });
  });

  // ── Single-owner token binding ──────────────────────────────

  describe("single-owner binding", () => {
    const localIds = {
      users: <string[]>[],
      courses: <string[]>[],
      modules: <string[]>[],
      lessons: <string[]>[],
      tokens: <string[]>[],
    };
    const testId = Date.now().toString(36);
    let rawToken: string;

    beforeAll(async () => {
      if (!isIntegrationTestEnv) return;
      // Student A — will redeem first
      const studentA = await createTestUser(
        svc,
        `owner-a-${testId}`,
        "passA123!",
        "student"
      );
      localIds.users.push(studentA.id);
      globalIds.users.push(studentA.id);

      // Student B — will try to redeem the same token
      const studentB = await createTestUser(
        svc,
        `owner-b-${testId}`,
        "passB123!",
        "student"
      );
      localIds.users.push(studentB.id);
      globalIds.users.push(studentB.id);

      // Admin
      const admin = await createTestUser(
        svc,
        `owner-admin-${testId}`,
        "adminPass!",
        "admin"
      );
      localIds.users.push(admin.id);
      globalIds.users.push(admin.id);

      // Published course
      const course = await seedTestCourse(svc, `owner-${testId}`);
      localIds.courses.push(course.courseId);
      localIds.modules.push(course.moduleId);
      localIds.lessons.push(course.lessonId);
      globalIds.courses.push(course.courseId);
      globalIds.modules.push(course.moduleId);
      globalIds.lessons.push(course.lessonId);

      // Token linked to course
      const token = await createTestToken(
        svc,
        `owner-${testId}`,
        [course.courseId],
        admin.id
      );
      rawToken = token.rawToken;
      localIds.tokens.push(token.tokenId);
      globalIds.tokens.push(token.tokenId);
    });

    it("first student redeems successfully", async () => {
      if (!isIntegrationTestEnv) return;
      const tokenHash = await hashToken(rawToken);
      const { data, error } = await svc.rpc("redeem_access_token", {
        p_token_hash: tokenHash,
        p_user_id: localIds.users[0],
      });

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data.success).toBe(true);
    });

    it("second student cannot redeem the same token", async () => {
      if (!isIntegrationTestEnv) return;
      const tokenHash = await hashToken(rawToken);
      const { data, error } = await svc.rpc("redeem_access_token", {
        p_token_hash: tokenHash,
        p_user_id: localIds.users[1],
      });

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data.success).toBe(false);
      expect(data.error).toBe("token_assigned_to_another_student");
    });

    it("first student can redeem again (same-owner refresh)", async () => {
      if (!isIntegrationTestEnv) return;
      const tokenHash = await hashToken(rawToken);
      const { data, error } = await svc.rpc("redeem_access_token", {
        p_token_hash: tokenHash,
        p_user_id: localIds.users[0],
      });

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data.success).toBe(true);
    });

    afterAll(async () => {
      if (!isIntegrationTestEnv) return;
      await cleanupAuthFlowData(
        svc,
        localIds.users,
        localIds.courses,
        localIds.modules,
        localIds.lessons,
        localIds.tokens
      );
    });
  });
});