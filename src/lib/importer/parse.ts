import initSqlJs from "sql.js";
import path from "node:path";
import type {
  ParseResult,
  ParsedCourse,
  ParsedModule,
  ParsedLesson,
  ImportWarning,
  SourceContentType,
  ContentType,
} from "@/types";

// ── Helpers ────────────────────────────────────────────────

/** Strip trailing dot, parse as float. Returns 0 for unparseable values. */
function normalizeChapterNum(num: unknown): number {
  if (typeof num !== "string" && typeof num !== "number") return 0;
  const cleaned = String(num).trim().replace(/\.$/, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/**
 * 64-bit FNV-1a hash for deterministic, reasonably collision-resistant
 * fingerprinting of source materials. Input format:
 *   `{type}:{courseId}:{chapterName}:{uniqueKey}`
 * Returns 16 hex chars.
 */
function computeFingerprint(
  type: SourceContentType,
  courseId: string,
  chapterName: string,
  uniqueKey: string,
): string {
  const input = `${type}:${courseId}:${chapterName}:${uniqueKey}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x6b8b4567;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    // eslint-disable-next-line no-bitwise
    h1 = Math.imul(h1 ^ c, 0x01000193);
    // eslint-disable-next-line no-bitwise
    h2 = Math.imul(h2 ^ c, 0x01b8e8b3);
  }
  return (
    // eslint-disable-next-line no-bitwise
    (h1 >>> 0).toString(16).padStart(8, "0") +
    // eslint-disable-next-line no-bitwise
    (h2 >>> 0).toString(16).padStart(8, "0")
  );
}

type SqlValue = number | string | Uint8Array | null;

function safeStr(v: SqlValue): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

function safeNum(v: SqlValue): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

// ── Raw row types matching source DB columns ───────────────

interface RawVideo {
  chapter_num: string;
  chapter_name: string;
  video_index: number;
  title: string;
  stream_url: string | null;
  wistia_url: string | null;
}

interface RawPdf {
  chapter_num: string;
  chapter_name: string;
  pdf_index: number;
  title: string;
  b2_key: string | null;
  bh_url: string | null;
  filename: string | null;
  file_size: number | null;
  stamped: number | null;
}

interface RawCodeFile {
  chapter_num: string;
  chapter_name: string;
  file_index: number;
  title: string;
  filename: string | null;
  b2_key: string | null;
  bh_url: string | null;
  file_size: number | null;
}

// ── Chapter-grouping structure ─────────────────────────────

interface ChapterGroup {
  chapter_num: string;
  chapter_name: string;
  videos: RawVideo[];
  pdfs: RawPdf[];
  codeFiles: RawCodeFile[];
}

// ── Duplicate handling ─────────────────────────────────────

/**
 * Source .db files (e.g. DBTest/apna_videos.db) contain literal
 * duplicate rows: some byte-identical copies, and a few rows that
 * share the logical fingerprint key (chapter + per-type unique key)
 * but carry genuinely different material (different stream URLs).
 *
 * Handling:
 *   1. Byte-identical rows are dropped here, keeping the first copy,
 *      and reported via a warning.
 *   2. Rows sharing a key but differing in material are ALL assigned
 *      a deterministic fingerprint derived from key + material
 *      signature, so every distinct material imports once.
 *   3. Lone rows keep the legacy fingerprint format
 *      ({type}:{courseId}:{chapter}:{uniqueKey}) so re-imports of
 *      previously-imported files stay idempotent.
 */
function dedupeRows<T>(
  rows: T[],
  type: SourceContentType,
  courseId: string,
  chapterName: string,
  getKey: (row: T) => string,
  label: (row: T) => string,
  warnings: ImportWarning[],
): Array<{ row: T; fingerprint: string }> {
  const typeLabel =
    type === "video" ? "video" : type === "pdf" ? "PDF" : "code file";

  // Group by logical key, preserving encounter order.
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = getKey(row);
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  const kept: Array<{ row: T; fingerprint: string }> = [];

  for (const [key, groupRows] of groups) {
    // 1. Collapse byte-identical copies (keep first).
    const seenSigs = new Map<string, T>();
    const distinct: Array<{ row: T; sig: string }> = [];
    let droppedCopies = 0;

    for (const row of groupRows) {
      const sig = JSON.stringify(row);
      if (seenSigs.has(sig)) {
        droppedCopies++;
        continue;
      }
      seenSigs.set(sig, row);
      distinct.push({ row, sig });
    }

    if (droppedCopies > 0) {
      warnings.push({
        level: "warning",
        message: `Removed ${droppedCopies} exact duplicate ${typeLabel} row(s) for "${label(
          groupRows[0],
        )}" in chapter "${chapterName}" (identical source data); keeping the first copy.`,
        source_type: type,
        source_key: key,
      });
    }

    // 2. Single distinct material → legacy fingerprint.
    if (distinct.length === 1) {
      kept.push({
        row: distinct[0].row,
        fingerprint: computeFingerprint(type, courseId, chapterName, key),
      });
      continue;
    }

    // 3. Distinct materials colliding on one key → deterministic
    //    disambiguated fingerprints (stable across re-imports).
    warnings.push({
      level: "info",
      message: `${distinct.length} distinct ${typeLabel} entries share the key "${key}" in chapter "${chapterName}"; importing all with material-disambiguated fingerprints.`,
      source_type: type,
      source_key: key,
    });

    for (const { row, sig } of distinct) {
      kept.push({
        row,
        fingerprint: computeFingerprint(
          type,
          courseId,
          chapterName,
          `${key}|${sig}`,
        ),
      });
    }
  }

  return kept;
}

// ── Parser ─────────────────────────────────────────────────

/**
 * Parse a SQLite .db file (from Apna College / similar sources) into a
 * normalized course/module/lesson tree matching the LearnForLess schema.
 *
 * The parser:
 *   - Validates required tables exist
 *   - Reads courses, videos, pdfs, code_files
 *   - Normalizes chapter_num (trailing dots stripped, numeric sort)
 *   - Groups materials by chapter_name
 *   - Orders lessons within a module: videos → pdfs → code_files
 *   - Generates stable source fingerprints for dedup
 *   - Collects warnings for malformed/missing data
 *
 * Does NOT write to any database.
 */
export async function parseDb(buffer: ArrayLike<number>): Promise<ParseResult> {
  const warnings: ImportWarning[] = [];

  let SQL: Awaited<ReturnType<typeof initSqlJs>>;
  let db: InstanceType<typeof SQL.Database>;

  try {
    SQL = await initSqlJs({
      locateFile: (file) => path.join(process.cwd(), "node_modules", "sql.js", "dist", file),
    });
    db = new SQL.Database(buffer);
  } catch (e) {
    return {
      success: false,
      error: `Failed to initialize SQLite: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  try {
    // ── Validate required tables ─────────────────────────
    const tablesResult = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('courses','videos','pdfs','code_files') ORDER BY name",
    );
    const tableNames = new Set(
      tablesResult[0]?.values.map((r: SqlValue[]) => String(r[0])) ?? [],
    );

    const missing = ["courses", "videos", "pdfs", "code_files"].filter(
      (t) => !tableNames.has(t),
    );
    if (missing.length > 0) {
      return {
        success: false,
        error: `Missing required tables: ${missing.join(", ")}`,
      };
    }

    // ── Read courses ─────────────────────────────────────
    const coursesResult = db.exec("SELECT id, name FROM courses ORDER BY rowid");
    if (!coursesResult[0] || coursesResult[0].values.length === 0) {
      return { success: false, error: "No courses found in database." };
    }

    const courseId = String(coursesResult[0].values[0][0]);
    const courseName = safeStr(coursesResult[0].values[0][1]) ?? "Untitled Course";

    if (coursesResult[0].values.length > 1) {
      warnings.push({
        level: "warning",
        message: `Database contains ${coursesResult[0].values.length} courses; importing only the first ("${courseId}").`,
        source_type: "pdf",
        source_key: null,
      });
    }

    // ── Read videos ──────────────────────────────────────
    const videosResult = db.exec(
      "SELECT chapter_num, chapter_name, video_index, title, stream_url, wistia_url FROM videos ORDER BY chapter_num, video_index",
    );
    const allVideos: RawVideo[] = [];
    for (const row of videosResult[0]?.values ?? []) {
      allVideos.push({
        chapter_num: safeStr(row[0]) ?? "",
        chapter_name: safeStr(row[1]) ?? "",
        video_index: Number(row[2]),
        title: safeStr(row[3]) ?? "Untitled Video",
        stream_url: safeStr(row[4]),
        wistia_url: safeStr(row[5]),
      });
    }

    // ── Read PDFs ────────────────────────────────────────
    const pdfsResult = db.exec(
      "SELECT chapter_num, chapter_name, pdf_index, title, b2_key, bh_url, filename, file_size, stamped FROM pdfs ORDER BY chapter_num, pdf_index",
    );
    const allPdfs: RawPdf[] = [];
    for (const row of pdfsResult[0]?.values ?? []) {
      allPdfs.push({
        chapter_num: safeStr(row[0]) ?? "",
        chapter_name: safeStr(row[1]) ?? "",
        pdf_index: Number(row[2]),
        title: safeStr(row[3]) ?? "Untitled PDF",
        b2_key: safeStr(row[4]),
        bh_url: safeStr(row[5]),
        filename: safeStr(row[6]),
        file_size: safeNum(row[7]),
        stamped: safeNum(row[8]),
      });
    }

    // ── Read code_files ──────────────────────────────────
    const codeResult = db.exec(
      "SELECT chapter_num, chapter_name, file_index, title, filename, b2_key, bh_url, file_size FROM code_files ORDER BY chapter_num, file_index",
    );
    const allCodeFiles: RawCodeFile[] = [];
    for (const row of codeResult[0]?.values ?? []) {
      allCodeFiles.push({
        chapter_num: safeStr(row[0]) ?? "",
        chapter_name: safeStr(row[1]) ?? "",
        file_index: Number(row[2]),
        title: safeStr(row[3]) ?? "Untitled Code File",
        filename: safeStr(row[4]),
        b2_key: safeStr(row[5]),
        bh_url: safeStr(row[6]),
        file_size: safeNum(row[7]),
      });
    }

    // ── Filter by course_id ──────────────────────────────
    const videos = allVideos.filter((v) => v.chapter_num !== ""); // all belong to courseId
    const pdfs = allPdfs.filter((p) => p.chapter_num !== "");
    const codeFiles = allCodeFiles.filter((c) => c.chapter_num !== "");

    // ── Build chapter groups ─────────────────────────────
    const chapterMap = new Map<string, ChapterGroup>();

    function ensureChapter(chapterNum: string, chapterName: string) {
      const existing = chapterMap.get(chapterName);
      if (!existing) {
        chapterMap.set(chapterName, {
          chapter_num: chapterNum,
          chapter_name: chapterName,
          videos: [],
          pdfs: [],
          codeFiles: [],
        });
      } else if (existing.chapter_num !== chapterNum) {
        warnings.push({
          level: "warning",
          message: `Chapter "${chapterName}" has conflicting chapter_num: "${existing.chapter_num}" vs "${chapterNum}". Using "${existing.chapter_num}".`,
          source_type: "pdf",
          source_key: null,
        });
      }
    }

    for (const v of videos) ensureChapter(v.chapter_num, v.chapter_name);
    for (const p of pdfs) ensureChapter(p.chapter_num, p.chapter_name);
    for (const c of codeFiles) ensureChapter(c.chapter_num, c.chapter_name);

    for (const v of videos) {
      chapterMap.get(v.chapter_name)?.videos.push(v);
    }
    for (const p of pdfs) {
      chapterMap.get(p.chapter_name)?.pdfs.push(p);
    }
    for (const c of codeFiles) {
      chapterMap.get(c.chapter_name)?.codeFiles.push(c);
    }

    // ── Sort chapters by normalized chapter_num ──────────
    const sortedChapters = [...chapterMap.entries()].sort((a, b) => {
      const numA = normalizeChapterNum(a[1].chapter_num);
      const numB = normalizeChapterNum(b[1].chapter_num);
      if (numA !== numB) return numA - numB;
      return a[0].localeCompare(b[0]);
    });

    // ── Build modules with lessons ───────────────────────
    const modules: ParsedModule[] = [];
    let moduleOrder = 1;

    for (const [, ch] of sortedChapters) {
      const lessons: ParsedLesson[] = [];
      let lessonOrder = 1;

      // 1. Videos (by video_index)
      const dedupedVideos = dedupeRows(
        [...ch.videos].sort((a, b) => a.video_index - b.video_index),
        "video",
        courseId,
        ch.chapter_name,
        (v) => String(v.video_index),
        (v) => v.title,
        warnings,
      );
      for (const { row: v, fingerprint } of dedupedVideos) {
        lessons.push({
          title: v.title,
          description: null,
          content_type: "video" as ContentType,
          sort_order: lessonOrder++,
          is_preview: false,
          source_fingerprint: fingerprint,
          external_source: "wistia",
          external_key: v.wistia_url,
          external_bh_url: null,
          file_size: null,
          source_stamped: null,
          content: v.stream_url ?? v.wistia_url,
          source_row: v as unknown as Record<string, unknown>,
        });
      }

      // 2. PDFs (by pdf_index)
      const dedupedPdfs = dedupeRows(
        [...ch.pdfs].sort((a, b) => a.pdf_index - b.pdf_index),
        "pdf",
        courseId,
        ch.chapter_name,
        (p) => p.title,
        (p) => p.title,
        warnings,
      );
      for (const { row: p, fingerprint } of dedupedPdfs) {
        lessons.push({
          title: p.title,
          description: null,
          content_type: "pdf" as ContentType,
          sort_order: lessonOrder++,
          is_preview: false,
          source_fingerprint: fingerprint,
          external_source: "b2",
          external_key: p.b2_key,
          external_bh_url: p.bh_url,
          file_size: p.file_size,
          source_stamped: p.stamped === 1 ? true : p.stamped === 0 ? false : null,
          content: null,
          source_row: p as unknown as Record<string, unknown>,
        });
      }

      // 3. Code files (by file_index)
      const dedupedCode = dedupeRows(
        [...ch.codeFiles].sort((a, b) => a.file_index - b.file_index),
        "code_file",
        courseId,
        ch.chapter_name,
        (c) => c.filename ?? c.title,
        (c) => c.title,
        warnings,
      );
      for (const { row: c, fingerprint } of dedupedCode) {
        lessons.push({
          title: c.title,
          description: c.filename ? `File: ${c.filename}` : null,
          content_type: "file" as ContentType,
          sort_order: lessonOrder++,
          is_preview: false,
          source_fingerprint: fingerprint,
          external_source: "b2",
          external_key: c.b2_key,
          external_bh_url: c.bh_url,
          file_size: c.file_size,
          source_stamped: null,
          content: null,
          source_row: c as unknown as Record<string, unknown>,
        });
      }

      // Warn about empty modules
      if (lessons.length === 0) {
        warnings.push({
          level: "warning",
          message: `Module "${ch.chapter_name}" has no lessons.`,
          source_type: "video",
          source_key: null,
        });
      }

      modules.push({
        title: ch.chapter_name,
        description: null,
        sort_order: moduleOrder++,
        source_chapter_num: ch.chapter_num,
        lessons,
      });
    }

    return {
      success: true,
      course: {
        source_id: courseId,
        source_type: "apna",
        title: courseName,
        description: null,
        modules,
      },
      warnings,
    };
  } catch (e) {
    return {
      success: false,
      error: `Parse error: ${e instanceof Error ? e.message : String(e)}`,
    };
  } finally {
    db.close();
  }
}