import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { parseDb } from "@/lib/importer/parse";

const DB_PATH = path.resolve(__dirname, "../../DBTest/apna_videos.db");

describe("parseDb (real DBTest/apna_videos.db)", () => {
  it("parses the supplied database into a typed course tree", async () => {
    const buffer = readFileSync(DB_PATH);
    const result = await parseDb(buffer);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.course.source_id).toBe("prime-2");
    expect(result.course.source_type).toBe("apna");
    expect(result.course.title).toContain("Prime 2.0");
    expect(result.course.modules.length).toBeGreaterThan(0);

    const totalLessons = result.course.modules.reduce(
      (n, m) => n + m.lessons.length,
      0,
    );
    expect(totalLessons).toBeGreaterThan(0);
  });

  it("normalizes chapter order numerically (trailing dots stripped)", async () => {
    const buffer = readFileSync(DB_PATH);
    const result = await parseDb(buffer);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const nums = result.course.modules.map((m) =>
      parseFloat(m.source_chapter_num.replace(/\.$/, "")),
    );
    const sorted = [...nums].sort((a, b) => a - b);
    expect(nums).toEqual(sorted);
  });

  it("assigns fingerprint + external metadata to every lesson", async () => {
    const buffer = readFileSync(DB_PATH);
    const result = await parseDb(buffer);
    expect(result.success).toBe(true);
    if (!result.success) return;

    for (const module of result.course.modules) {
      const orders = module.lessons.map((l) => l.sort_order);
      expect(orders).toEqual([...orders].sort((a, b) => a - b));

      for (const lesson of module.lessons) {
        expect(lesson.source_fingerprint).toMatch(/^[0-9a-f]{16}$/);
        expect(["video", "pdf", "file"]).toContain(lesson.content_type);
        if (lesson.content_type === "video") {
          expect(lesson.external_source).toBe("wistia");
          expect(lesson.content).toBeTruthy();
        } else if (lesson.content_type === "pdf") {
          expect(lesson.external_source).toBe("b2");
          expect(lesson.external_key).toBeTruthy();
        } else {
          expect(lesson.external_source).toBe("b2");
          expect(lesson.external_key).toBeTruthy();
        }
      }
    }
  });

  it("contains the known sample rows (2 videos, 15 pdfs, 3 code files)", async () => {
    const buffer = readFileSync(DB_PATH);
    const result = await parseDb(buffer);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const videos = result.course.modules.flatMap((m) =>
      m.lessons.filter((l) => l.content_type === "video"),
    );
    const pdfs = result.course.modules.flatMap((m) =>
      m.lessons.filter((l) => l.content_type === "pdf"),
    );
    const files = result.course.modules.flatMap((m) =>
      m.lessons.filter((l) => l.content_type === "file"),
    );

    expect(videos).toHaveLength(2);
    expect(pdfs).toHaveLength(15);
    expect(files).toHaveLength(3);
  });
});