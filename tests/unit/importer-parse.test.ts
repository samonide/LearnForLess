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

  it("deduplicates source rows and yields globally unique fingerprints (H2)", async () => {
    const buffer = readFileSync(DB_PATH);
    const result = await parseDb(buffer);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const lessons = result.course.modules.flatMap((m) => m.lessons);

    // No fingerprint may repeat — duplicates would abort the import on
    // lessons_source_fingerprint_unique.
    const fingerprints = new Set(lessons.map((l) => l.source_fingerprint));
    expect(fingerprints.size).toBe(lessons.length);

    // The real apna_videos.db contains byte-identical duplicate video
    // rows; the parser must report every dropped copy.
    const dropWarnings = result.warnings.filter(
      (w) => w.level === "warning" && w.message.includes("exact duplicate"),
    );
    expect(dropWarnings.length).toBeGreaterThan(0);
    const droppedRows = dropWarnings.reduce(
      (n, w) => n + Number(w.message.match(/Removed (\d+)/)![1]),
      0,
    );
    expect(droppedRows).toBe(46);
  });

  it("collapses known triplicated row to a single lesson", async () => {
    const buffer = readFileSync(DB_PATH);
    const result = await parseDb(buffer);
    expect(result.success).toBe(true);
    if (!result.success) return;

    // "Orientation Session (Recording)" appears three times, byte
    // identical, in the source videos table.
    const orientation = result.course.modules.flatMap((m) => m.lessons).filter(
      (l) => l.title === "Orientation Session (Recording)",
    );
    expect(orientation).toHaveLength(1);
  });

  it("imports same-key different-material rows as distinct lessons", async () => {
    const buffer = readFileSync(DB_PATH);
    const result = await parseDb(buffer);
    expect(result.success).toBe(true);
    if (!result.success) return;

    // "Relational Operators" / "Assignment Operators" / "Logical
    // Operators" share their logical key but carry different stream
    // URLs — both materials must survive with distinct fingerprints.
    const disambiguationInfos = result.warnings.filter(
      (w) => w.level === "info" && w.message.includes("disambiguated"),
    );
    expect(disambiguationInfos.length).toBe(3);

    const pythonFundamentals = result.course.modules.find(
      (m) => m.title === "Python Fundamentals (Part 1)",
    );
    expect(pythonFundamentals).toBeDefined();

    // Each of the three titles carries two distinct materials
    // (e.g. "Relational Operators" exists twice with one URL and once
    // with another) → 6 lessons after dedup, all uniquely fingerprinted.
    const operators = pythonFundamentals!.lessons.filter((l) =>
      ["Relational Operators", "Assignment Operators", "Logical Operators"].includes(l.title),
    );
    expect(operators).toHaveLength(6);

    const fps = new Set(operators.map((l) => l.source_fingerprint));
    expect(fps.size).toBe(6);

    for (const title of ["Relational Operators", "Assignment Operators", "Logical Operators"]) {
      const pair = operators.filter((l) => l.title === title);
      expect(pair).toHaveLength(2);
      expect(pair[0].content).not.toBe(pair[1].content);
      expect(pair[0].source_fingerprint).not.toBe(pair[1].source_fingerprint);
      for (const lesson of pair) {
        expect(lesson.content).toBeTruthy();
      }
    }
  });
});