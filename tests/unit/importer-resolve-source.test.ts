import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { generateB2PresignedUrl } from "@/lib/importer/resolve-source";

const ORIGINAL_ENV = { ...process.env };

// Known-good B2 credentials for sandbox test keys; these are deliberately
// placeholder values and never used outside tests.
const TEST_ENV = {
  B2_ENDPOINT: "https://s3.eu-central-003.backblazeb2.com",
  B2_BUCKET: "samonide-pdf-storage",
  B2_KEY_ID: "0033460544f8d9f0000000001",
  B2_APP_KEY: "K003064GaKhKCh26s9lqJmcS4EnZcRE",
  B2_REGION: "eu-central-003",
};

beforeAll(() => {
  process.env = { ...ORIGINAL_ENV, ...TEST_ENV };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("generateB2PresignedUrl", () => {
  it("generates a presigned URL with SigV4 query params", async () => {
    const result = await generateB2PresignedUrl("some/key.pdf");
    expect(result).not.toBeNull();
    if (!result) return;
    const url = new URL(result.url);
    expect(url.hostname).toContain("s3.eu-central-003.backblazeb2.com");
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(url.searchParams.get("X-Amz-Credential")).toContain(
      "0033460544f8d9f0000000001"
    );
    expect(url.searchParams.get("X-Amz-Expires")).toBe("3600");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain("host");
    expect(url.searchParams.has("X-Amz-Signature")).toBe(true);
    expect(url.searchParams.has("X-Amz-Date")).toBe(true);
  });

  it("returns null for an empty key", async () => {
    const result = await generateB2PresignedUrl("");
    expect(result).toBeNull();
  });

  it("returns null for a whitespace/invalid key", async () => {
    const result = await generateB2PresignedUrl(" bad/key");
    expect(result).toBeNull();
  });

  it("returns null for a key with query params", async () => {
    const result = await generateB2PresignedUrl("key.pdf?x=1");
    expect(result).toBeNull();
  });

  it("returns null when B2 credentials are missing", async () => {
    process.env.B2_APP_KEY = "";
    const result = await generateB2PresignedUrl("key.pdf");
    expect(result).toBeNull();
    process.env.B2_APP_KEY = TEST_ENV.B2_APP_KEY;
  });

  it("uses custom expiry", async () => {
    const result = await generateB2PresignedUrl("some/key.pdf", {
      expiresIn: 7200,
    });
    expect(result).not.toBeNull();
    if (!result) return;
    expect(new URL(result.url).searchParams.get("X-Amz-Expires")).toBe("7200");
  });

  it("URL-encodes special characters in the key", async () => {
    const result = await generateB2PresignedUrl("dir with space/file:name/ünïcode.pdf");
    expect(result).not.toBeNull();
    if (!result) return;
    const url = new URL(result.url);
    expect(url.pathname).toContain("dir%20with%20space");
    expect(url.pathname).toContain("file%3Aname");
    expect(url.pathname).toContain("%C3%BCn%C3%AFcode.pdf");
  });
});