import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  isIntegrationTestEnv,
  getServiceClient,
  createTestUser,
  cleanupTestData,
} from "../integration/setup";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateB2PresignedUrl } from "@/lib/importer/resolve-source";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseDb } from "@/lib/importer/parse";

const DB_PATH = path.resolve(__dirname, "../../DBTest/apna_videos.db");

let b2Configured = false;
const globalIds: { users: string[] } = { users: [] };

describe("B2 media source resolution (integration)", () => {
  let svc: SupabaseClient;

  beforeAll(async () => {
    if (!isIntegrationTestEnv) return;
    svc = getServiceClient();

    b2Configured = Boolean(
      process.env.B2_ENDPOINT &&
      process.env.B2_BUCKET &&
      process.env.B2_KEY_ID &&
      process.env.B2_APP_KEY &&
      process.env.B2_REGION
    );
    if (!b2Configured) return;
  });

  afterAll(async () => {
    if (!isIntegrationTestEnv) return;
    await cleanupTestData(svc, globalIds.users, []);
  });

  it("generates a valid B2 presigned URL with real credentials", async () => {
    if (!isIntegrationTestEnv || !b2Configured) return;

    const result = await generateB2PresignedUrl("apna_videos.pdf");
    expect(result).not.toBeNull();
    if (!result) return;

    const url = new URL(result.url);
    expect(url.hostname).toContain("backblazeb2.com");
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(url.searchParams.get("X-Amz-Credential")).toContain(
      process.env.B2_KEY_ID
    );
    expect(url.searchParams.get("X-Amz-Expires")).toBe("3600");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain("host");
    expect(url.searchParams.has("X-Amz-Signature")).toBe(true);
    expect(url.searchParams.has("X-Amz-Date")).toBe(true);
  });

  it("returns null for invalid B2 keys", async () => {
    if (!isIntegrationTestEnv || !b2Configured) return;

    expect(await generateB2PresignedUrl("")).toBeNull();
    expect(await generateB2PresignedUrl("   bad key   ")).toBeNull();
    expect(await generateB2PresignedUrl("key.pdf?x=1")).toBeNull();
  });

  it("preserves correct source metadata for all content types", async () => {
    if (!isIntegrationTestEnv || !b2Configured) return;

    const buffer = readFileSync(DB_PATH);
    const parseResult = await parseDb(buffer);
    expect(parseResult.success).toBe(true);
    if (!parseResult.success) return;

    const allLessons = parseResult.course.modules.flatMap((m) => m.lessons);

    for (const v of allLessons.filter((l) => l.content_type === "video")) {
      expect(v.external_source).toBe("wistia");
      expect(v.content).toMatch(/\.m3u8$/);
    }

    for (const p of allLessons.filter((l) => l.content_type === "pdf")) {
      expect(p.external_source).toBe("b2");
      expect(p.external_key).toBeTruthy();
      expect(p.content).toBeNull();
    }

    for (const f of allLessons.filter((l) => l.content_type === "file")) {
      expect(f.external_source).toBe("b2");
      expect(f.external_key).toBeTruthy();
      expect(f.content).toBeNull();
    }
  });
});