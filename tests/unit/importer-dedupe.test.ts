import initSqlJs from "sql.js";
import path from "node:path";
import { describe, it, expect, beforeAll } from "vitest";
import { parseDb } from "@/lib/importer/parse";

/**
 * Controlled duplicate-scenario fixtures (H2).
 *
 * The real DBTest/apna_videos.db proves the source data contains both
 * byte-identical duplicate rows and same-key/different-material rows,
 * but a synthetic database lets us pin exact parser behavior per case:
 *   1. exact duplicate row   → dropped once, warning emitted
 *   2. same key, other URL   → both kept, disambiguated fingerprints
 *   3. untouched single rows → unchanged legacy fingerprints
 *   4. whole parse           → deterministic across runs
 */

let sourceDb: Uint8Array;

beforeAll(async () => {
  const SQL = await initSqlJs({
    locateFile: (file) =>
      path.join(process.cwd(), "node_modules", "sql.js", "dist", file),
  });
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE courses (id TEXT PRIMARY KEY, name TEXT, scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT, course_id TEXT, chapter_num TEXT, chapter_name TEXT,
      video_index INTEGER, title TEXT, wistia_url TEXT, stream_url TEXT, downloaded INTEGER DEFAULT 0);
    CREATE TABLE pdfs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, course_id TEXT, chapter_num TEXT, chapter_name TEXT,
      pdf_index INTEGER, title TEXT, b2_key TEXT, bh_url TEXT, filename TEXT, file_size INTEGER,
      stamped INTEGER DEFAULT 1, uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE code_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT, course_id TEXT, chapter_num TEXT, chapter_name TEXT,
      file_index INTEGER, title TEXT, filename TEXT, b2_key TEXT, bh_url TEXT,
      file_size INTEGER, scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

    INSERT INTO courses (id, name) VALUES ('dup-course', 'Dup Test Course');

    -- Case 1: byte-identical duplicate video rows
    INSERT INTO videos (course_id, chapter_num, chapter_name, video_index, title, wistia_url, stream_url) VALUES
      ('dup-course', '1.', 'Chapter A', 1, 'Lesson One', 'wistia-1', 'https://stream/one'),
      ('dup-course', '1.', 'Chapter A', 1, 'Lesson One', 'wistia-1', 'https://stream/one');

    -- Case 2: same logical key, different material (stream URL)
    INSERT INTO videos (course_id, chapter_num, chapter_name, video_index, title, wistia_url, stream_url) VALUES
      ('dup-course', '1.', 'Chapter A', 2, 'Split Lesson', 'wistia-2a', 'https://stream/two-a'),
      ('dup-course', '1.', 'Chapter A', 2, 'Split Lesson', 'wistia-2b', 'https://stream/two-b');

    -- Case 3: untouched single row
    INSERT INTO videos (course_id, chapter_num, chapter_name, video_index, title, wistia_url, stream_url) VALUES
      ('dup-course', '2.', 'Chapter B', 1, 'Solo Video', null, 'https://stream/solo');

    -- Exact duplicate PDF row
    INSERT INTO pdfs (course_id, chapter_num, chapter_name, pdf_index, title, b2_key, bh_url, filename, file_size, stamped) VALUES
      ('dup-course', '2.', 'Chapter B', 1, 'Notes PDF', 'b2/notes.pdf', 'https://bh/notes', 'notes.pdf', 1024, 1),
      ('dup-course', '2.', 'Chapter B', 1, 'Notes PDF', 'b2/notes.pdf', 'https://bh/notes', 'notes.pdf', 1024, 1);

    -- Single code file row
    INSERT INTO code_files (course_id, chapter_num, chapter_name, file_index, title, filename, b2_key, bh_url, file_size) VALUES
      ('dup-course', '2.', 'Chapter B', 1, 'Solution Code', 'solution.zip', 'b2/solution.zip', 'https://bh/solution', 2048);
  `);
  sourceDb = db.export();
  db.close();
});

type ParseOk = Extract<Awaited<ReturnType<typeof parseDb>>, { success: true }>;

function moduleTitles(modules: ParseOk["course"]["modules"]) {
  return modules.map((m) => m.title);
}

describe("parseDb duplicate handling (H2)", () => {
  it("drops byte-identical duplicate rows and warns", async () => {
    const result = await parseDb(sourceDb);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const chapterA = result.course.modules.find((m) => m.title === "Chapter A");
    expect(chapterA).toBeDefined();

    // 2 copies of Lesson One collapse to 1 lesson.
    const lessonOnes = chapterA!.lessons.filter((l) => l.title === "Lesson One");
    expect(lessonOnes).toHaveLength(1);

    const dropWarnings = result.warnings.filter(
      (w) => w.level === "warning" && w.message.includes("exact duplicate"),
    );
    const lessonOneDrop = dropWarnings.find((w) =>
      w.message.includes('"Lesson One"'),
    );
    expect(lessonOneDrop).toBeDefined();
    expect(lessonOneDrop!.message).toContain("Removed 1");
    expect(lessonOneDrop!.source_type).toBe("video");

    // Duplicate PDF collapses too.
    const notesPdfs = result.course.modules
      .flatMap((m) => m.lessons)
      .filter((l) => l.title === "Notes PDF");
    expect(notesPdfs).toHaveLength(1);
    const pdfDrop = dropWarnings.find((w) => w.message.includes('"Notes PDF"'));
    expect(pdfDrop).toBeDefined();
  });

  it("keeps same-key different-material rows as distinct lessons", async () => {
    const result = await parseDb(sourceDb);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const chapterA = result.course.modules.find((m) => m.title === "Chapter A")!;
    const splits = chapterA.lessons.filter((l) => l.title === "Split Lesson");

    expect(splits).toHaveLength(2);
    expect(splits[0].source_fingerprint).not.toBe(splits[1].source_fingerprint);
    expect(splits[0].content).toBe("https://stream/two-a");
    expect(splits[1].content).toBe("https://stream/two-b");
    expect(splits[0].external_key).toBe("wistia-2a");
    expect(splits[1].external_key).toBe("wistia-2b");

    const infos = result.warnings.filter(
      (w) => w.level === "info" && w.message.includes("disambiguated"),
    );
    expect(infos.some((w) => w.message.includes('"2"'))).toBe(true);
  });

  it("produces no duplicate fingerprints anywhere in the output", async () => {
    const result = await parseDb(sourceDb);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const lessons = result.course.modules.flatMap((m) => m.lessons);
    const fps = lessons.map((l) => l.source_fingerprint);
    expect(new Set(fps).size).toBe(fps.length);
  });

  it("is deterministic: two parses of the same bytes agree exactly", async () => {
    const first = await parseDb(sourceDb);
    const second = await parseDb(sourceDb);
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    if (!first.success || !second.success) return;

    const fpA = first.course.modules.flatMap((m) => m.lessons.map((l) => l.source_fingerprint));
    const fpB = second.course.modules.flatMap((m) => m.lessons.map((l) => l.source_fingerprint));
    expect(fpB).toEqual(fpA);
    expect(moduleTitles(second.course.modules)).toEqual(moduleTitles(first.course.modules));
  });
});
