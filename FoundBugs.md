# Found Bugs — Full Audit (2026-08-22)

Scope: whole codebase audited (migrations vs code vs live DB, auth, actions, storage, importer, UI) + user-reported bugs investigated.

Status markers:
- **FIXED W1** = fixed in Bug Fix Wave 1 (C1-A, C1-B, C2, H2)
- **FIXED W2** = fixed in Bug Fix Wave 2 (all others marked below)
- **LIVE-VERIFIED** = reproduced against the hosted Supabase project (read-only or fully-cleaned probes)
- **CODE-VERIFIED** = confirmed by tracing actual code paths
- **NEEDS INFO** = cannot be pinned without runtime repro details

> Wave 2 shipped two new migrations that MUST be applied to hosted Supabase via SQL Editor:
> - `supabase/migrations/009_signup_role_hardening.sql` (C4)
> - `supabase/migrations/010_course_thumbnails.sql` (C3 — creates the public `course-thumbnails` bucket and nulls legacy broken thumbnail URLs)

---

## CRITICAL — structure breakers / security

### C1. Token redemption renames students to the token name + RPC is anonymously callable with attacker-chosen `p_user_id` — **FIXED W1** (migration 008 applied + verified: anon EXECUTE=false, authenticated EXECUTE=true)
**LIVE-VERIFIED (both parts).**

**Part A — your "Username Issue" (confirmed live):** Redeeming a token set a test student's `display_name` from `probestu…` → `"SIGMA-TOKEN-NAME"` and nulled their email, while `username` stayed untouched (which is exactly why login with the old username still works — login resolves via `profiles.username`, the header shows `display_name || username`).
Root cause: **the live database runs the OLD version of `redeem_access_token`.** Git history proves it: pre-fix code was `VALUES (p_user_id, NULL, v_token.name, 'student')` + `COALESCE(EXCLUDED.display_name, …)` (prefers token name). The migration *file* was corrected in commit `acda197`, but migrations are applied manually via SQL Editor and the fixed function was never re-run on the live project.
Fix context:
1. Re-apply the corrected function from `supabase/migrations/002_token_student_accounts.sql` in the SQL Editor (the `CREATE OR REPLACE FUNCTION redeem_access_token` block). Optionally verify first: `SELECT prosrc FROM pg_proc WHERE proname='redeem_access_token';` — if it contains `v_token.name`, you're on the old build.
2. Also repair already-damaged rows (students currently named after tokens): restore `display_name` from `profiles.username` where they diverge.
3. Then apply Part B below, which hardens the same function.

**Part B — privilege escalation hole:** The RPC is `SECURITY DEFINER`, takes caller-supplied `p_user_id`, and has no `auth.uid()` guard. Live probe proved an anonymous (no session) client can execute it (`{"error":"invalid_token","success":false}` to a bogus-hash call instead of a permission error). Anyone holding ONE valid raw token can pass any target's UUID as `p_user_id` → bind the token to that user, force `role='student', email=NULL` on their profile (**demote admins**, wipe emails), and delete/reinsert the victim's token-granted courses. Migration 005 fixed the other two RPCs but skipped this one.
Fix context: add `IF p_user_id <> auth.uid() THEN RETURN unauthorized; END IF;` inside the function, `REVOKE EXECUTE ON FUNCTION public.redeem_access_token FROM anon, public;`, and drop the `role='student', email=NULL` upsert arms entirely (a redemption has no business touching role/email/display_name of an existing profile).

### C2. Server Action 1MB body limit silently breaks every upload feature — **FIXED W1** (`experimental.serverActions.bodySizeLimit: "525mb"` in `next.config.ts`)
**VERIFIED** against bundled Next.js 16.3 docs (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md`: default request-body cap for Server Actions = 1MB).

- `next.config.ts` is empty — no `serverActions.bodySizeLimit`. (`src/proxy.ts` also buffers bodies with its own 10MB cap, but the 1MB action limit hits first.)
- Broken flows: `uploadLessonFile` (`src/actions/admin/lessons.ts:255`, UI promises "up to 500 MB"), `importCourse` / `parseImport` (`src/actions/admin/import-course.ts:805,871` — real course `.db` files are almost always >1MB), `uploadCourseThumbnail` (`src/actions/admin/courses.ts:227` — photos >1MB fail).
- Fix context: set `experimental.serverActions.bodySizeLimit` (e.g. `'525mb'`) in `next.config.ts`; consider raising `proxyClientMaxBodySize` to match. Long-term: large uploads belong behind a Route Handler / direct-to-storage signed upload rather than a Server Action.

### C3. Course thumbnails/poster images are stored as URLs that can never load — **FIXED W2**
**CODE-VERIFIED** (bucket flag couldn't be queried live — storage schema not exposed via this project's PostgREST cache; migration 001 + docs both say private).

- `src/actions/admin/courses.ts:244-252` uploads into the **private** `course-materials` bucket, then stores `getPublicUrl()` output as `thumbnail_url`. Anonymous requests to `/object/public/...` on a private bucket 403 → broken images everywhere thumbnails render (student dashboard cards, admin lists, edit form preview).
- Resolution (option a from fix context): new dedicated **public** bucket `course-thumbnails` (10MB cap, image mime allow-list) via migration 010; `uploadCourseThumbnail()` now uploads there and stores its public URL; stale object removed when extension changes; legacy broken `/object/public/course-materials/` thumbnail URLs nulled by the same migration so placeholders show until re-upload.
- Requires applying `supabase/migrations/010_course_thumbnails.sql` on hosted Supabase.

### C4. Signup metadata can grant `role='admin'` if open signups are enabled — **FIXED W2**
**CODE-VERIFIED**; exploitability depends on one dashboard setting I can't see from the repo.

- `supabase/migrations/001_schema.sql:650-666` — `handle_new_user()` trusts `raw_user_meta_data->>'role'`. App-side registration always sends `'student'`, but the anon key is public: a direct `signUp({ options: { data: { role: 'admin' } } })` creates an admin profile if "Allow new users to sign up" is on.
- Resolution: migration 009 hardcodes `'student'` in the trigger (defense in depth; display_name from metadata kept — cosmetic only). **Still check** Authentication → Providers → Email → "Allow new users to sign up" in the dashboard. Optional review query for suspicious legacy admin profiles included (commented) in the migration.

---

## HIGH

### H1. Replacement re-import silently destroys all student progress on imported lessons — **FIXED W2**
**CODE-VERIFIED.**

- `src/actions/admin/import-course.ts:467-543` — replacement deletes imported lessons then re-inserts them **with new UUIDs**; `lesson_progress.lesson_id` FK is `ON DELETE CASCADE` → every completion/resume record for those lessons is wiped permanently and never reconnects.
- Resolution: `doReplacementImport()` now snapshots `lesson_progress` rows (user, completed, percentage, position) for all imported lessons **before** deletion, then after recreation re-links them to the new lesson ids via the source-fingerprint mapping (dedup by user+new-lesson with OR-completion / max-percentage merge; chunked upserts of 500). Rollback path also restores the original progress rows alongside the restored lessons. `ImportResult.progressRestored` reports the count; import UI shows "Student progress preserved: N records" and the replacement confirmation dialog now says progress is re-linked instead of silently lost.

### H2. Import fails with `lessons_source_fingerprint_unique` duplicate-key errors — **FIXED W1** (parser dedupe + material-disambiguated fingerprints; skip+warn on conflict in all three modes)
**LIVE-DATA-VERIFIED** against `DBTest/apna_videos.db`.

- Answer to your question: the source DB contains **literal duplicate rows**. Example: `videos` has `"Orientation Session (Recording)"` (chapter `Live Mentorship Sessions`, index 1) **three times, byte-identical**. Total across the file: **49 colliding lessons** (same chapter + same video_index/title appearing 2–4×). Most are pure copies (`distinct stream_urls = 1`); three pairs ("Relational Operators", "Assignment Operators", "Logical Operators") share a key but carry **different stream_urls** — genuinely distinct materials colliding on the fingerprint key `(type, courseId, chapterName, videoIndex|title)`.
- Why it crashes: `doNewImport → createModules → insertLesson` (`import-course.ts:659-663`) blind-inserts every parsed row; the second copy violates `lessons_source_fingerprint_unique` → whole import aborts (and your next attempt hits the same error forever since no course got created). Replacement mode has the same blind-insert loop. Incremental mode only survives by accident — it tracks fingerprints in a map mid-batch.
- Fix context (two layers):
  1. Parse stage (`src/lib/importer/parse.ts`): dedupe exact duplicate rows (keep first), emit an ImportWarning listing what was dropped. For same-key-but-different-URL rows, disambiguate the fingerprint (e.g. append a short hash of `stream_url`/`filename`) so distinct materials both import.
  2. Import actions: make `insertLesson` tolerant — on unique violation, skip + warn instead of aborting the run.

### H3. Mark-as-Complete reported broken — **FIXED W3** (progress read silently failed on large courses; write path was always fine)
**REPRODUCED + LIVE-VERIFIED (real enrolled student, real browser, hosted Supabase).**

W2 had already exonerated the DB write path (upsert OK on insert and conflict arms) and hardened the preview UX. This session reproduced the *enrolled-student* failure exactly: clicking "Mark as Complete" showed the success toast and the row landed in `lesson_progress` (`completed:true, 100%`) — yet a fresh page load rendered the lesson as **not completed**: no "Lesson Completed" indicator, button active again, sidebar `0 / 1 Completed`, course progress 0%.

**Root cause — silent data loss in the read path, not the write path:** `getCourseForViewer()` fetched progress with `.in("lesson_id", allLessonIds)`. Prime 2.0 legitimately has **785 lessons**, producing a ~35 KB query URL that Supabase rejects with HTTP 400 before PostgREST even parses it. The code destructured only `{ data: progressData }` and never checked `error`, so every page render silently built an empty progress map. Small courses kept the URL under the limit, which is why completion appeared to work on some courses and never on imported ones. (Verified empirically: exact app query via supabase-js as the enrolled student → `status=400`; same query on a small id subset → 200.)

**Resolution (`src/actions/student/courses.ts`):** single embedded fetch through the FK chain `modules → lessons → lesson_progress(...)` — Postgres joins server-side, so request size no longer scales with course length; RLS scopes embedded rows to the calling user (verified: student sees only own rows among all users' rows); embedded rows are stripped from the client payload. The broken `.in()` fetch is gone.

Verification (all against live dev server): revisit of a completed lesson now shows indicator + disabled state + `1 / 1 Completed`; real click → toast → auto-advance → next page's sidebar instantly shows both modules complete (previously the exact moment it broke); reload persists; course overview reads "2 of 785 lessons completed"; DB rows match UI; `tsc --noEmit` clean. Note: overall % stays 0% at 2/785 by correct rounding — module counters are the granular feedback.

Residual: `admin/import-course.ts:496` also uses `.in("lesson_id", …)` but over one import batch (bounded), admin context, not user-facing — left as-is.

### H4. Lesson file replacement deletes the old object before the new upload succeeds — **FIXED W2**
**CODE-VERIFIED.** `src/actions/admin/lessons.ts:278-296` removed the existing storage object, *then* uploaded; a failed upload left `storage_path` pointing at a deleted object → lesson permanently broken. Resolution: `uploadLessonFile()` now uploads (and links) the new file first and removes the old object only after both succeed.

### H5. Reorder actions swallow errors — **FIXED W2** (error-swallowing; per-item atomicity note)
**CODE-VERIFIED.** `lessons.ts:233-241`, `modules.ts:187-195` discarded each update's result. Resolution: `reorderLessons()` / `reorderModules()` now collect all results and fail with "Reorder failed: …" on any error instead of reporting success. Residual note: updates are still issued as independent statements (no single transaction), so a mid-flight failure can leave a partial order until retried — retries are idempotent and now surface the error.

### H6. Lesson editor hides imported content — admins can't see stream URLs or external keys of imported courses — **FIXED W2**
**CODE-VERIFIED.**

- Imported videos store their playable URL in `content`; imported PDFs/code files carry `external_key` / `external_bh_url`, but the editor only rendered `content` for text/link types → imported media lessons showed an empty dropzone and one save would have nulled the stream URL (`content: null` was always sent for media types).
- Resolution in `lesson-editor.tsx`: media lessons that kept their type show an **Imported source** panel (read-only Stream URL / Storage key + backup link) above the upload zone, and saving no longer overwrites `content` for same-type media lessons (imported sources are preserved). Changing content type away still clears stale `content`/`storage_path` explicitly (see M6). Server-side `updateLesson()` also gained an M5 backstop so a media lesson can never end up with zero sources.

### H7. Recovery-token single-use is not concurrency-safe — **FIXED W2**
**CODE-VERIFIED.** `recovery.ts:129-137` marked `used_at` without checking the conditional update matched a row; two concurrent submissions could both pass validation. Resolution: the claim update now chains `.is("used_at", null)` with `.select("id")` and treats zero returned rows as `recovery_token_used`.

---

## MEDIUM

### M1. PDF viewer doesn't render imported PDFs — **FIXED W3** (B2 bucket CORS rule; pure configuration, zero code changes)
**REPRODUCED + LIVE-VERIFIED (real student lesson flow in a real browser against hosted Supabase + hosted B2).**

Your proposed fix ("generate the .pdf link via Backblaze API when someone clicks the pdf") is literally what the code already does: `getLessonContent()` (`student/courses.ts:274-281`) calls `generateB2PresignedUrl(external_key)` server-side at view time and returns it as `signed_url`; the viewer uses `signed_url || content`. So the feature isn't missing.

**Actual root cause (case 2 of the three candidates below — the others were ruled out with evidence):**
- The B2 bucket `learnforless` had **no CORS rules at all**: `OPTIONS` preflight → 403, and `GET` with an `Origin` header returned 200 + `Content-Type: application/pdf` but **no `Access-Control-Allow-Origin` header**. pdf.js fetches the presigned URL cross-origin from the browser, so every fetch was blocked (`net::ERR_FAILED`, "Failed to fetch") even though the URL itself was valid — reproducing exactly this in Playwright before the fix: worker loaded fine, presigned URL generated fine, canvas count 0.
- Ruled out candidate 1 (env vars): all five `B2_*` vars are set locally; presign succeeds server-side for real keys (e.g. `Installation Guide.pdf` → valid signed URL → 200). Note for Phase 6: the future deployment must also carry these five vars or that environment will hit case 1 (buzzheavier HTML fallback).
- Ruled out candidate 3 (worker CDN): `https://unpkg.com/pdfjs-dist@<pdfjs.version>/build/pdf.worker.min.mjs` returns 200 (`ACAO: *`) for both the bundled react-pdf pdfjs (5.4.296) and installed pdfjs-dist (6.2.108).

**Resolution (configuration applied via B2 native API `b2_update_bucket` on bucket `83342680151424bfa80d091f`):**
```
corsRuleName:   learnforlessAppPdfViewer
allowedOrigins: ["*"]          ← tighten to your production origin(s) when deploying (Phase 6)
allowedOperations: ["b2_download_file_by_name", "b2_download_file_by_id", "s3_get"]
allowedHeaders: ["*"]
exposeHeaders:  [content-range, content-length, content-type, etag, last-modified, accept-ranges]
maxAgeSeconds:  3600
```
Bucket is private/presigned-only, so `*` origins expose nothing by themselves; still, replace with explicit origins (e.g. `["http://localhost:3000", "https://yourdomain.com"]`) at deploy time via the Backblaze dashboard (Bucket → Settings → CORS Rules) or `b2_update_bucket`.

**Post-fix verification (all through the real student flow):**
- Imported B2 PDF renders: canvases painted, page indicator correct ("Page 1 of 10"), scrolling works end-to-end (indicator advances to "Page 10 of 10" at bottom), download link serves 200 / `application/pdf` / correct bytes, zero console errors.
- Supabase-stored PDF (temp lesson on `course-materials` via signed URL) renders identically — path untouched and confirmed working (test artifact cleaned up afterwards).
- `npx tsc --noEmit` clean, `npm run build` clean (no source changes made).

Original triage notes (for history): the three suspected failure points were:
1. Missing B2 env vars on the deployed server (`B2_ENDPOINT/BUCKET/KEY_ID/APP_KEY/REGION`) → presign returns null → falls back to `external_bh_url`, which is a **Buzzheavier share page (HTML), not a PDF file** → react-pdf can't parse it → "Failed to load PDF".
2. **B2 bucket CORS** ← this was the actual cause.
3. Worker CDN from unpkg at runtime.

### M2. `generateSlug()` returns empty string for non-Latin titles — **FIXED W2**
**CODE-VERIFIED.** `lib/utils.ts:81-88` stripped everything outside `[a-z0-9-_ ]`; Hindi/Chinese/symbol-only titles → `slug=''`. Resolution: empty result now falls back to `course-${Date.now().toString(36)}` so the unique constraint can't be hit with a misleading empty-slug violation.

### M3. Admin search breaks on ordinary input characters — **FIXED W2**
**CODE-VERIFIED.** `admins.ts:48` interpolated raw input into a PostgREST `.or(...)` filter; commas/parens corrupt syntax → 400. Resolution: search terms are now double-quoted inside the filter (PostgRESST literal-value quoting), embedded quotes are doubled, and LIKE wildcards (`%`, `_`, `\`) are escaped so input matches literally. Searching "Doe, John" works.

### M4. Progress updates accept unvalidated numbers — **FIXED W2**
**CODE-VERIFIED.** `progress.ts:41-51` stored `progress_percentage`/`last_position` as-is (99999/negatives OK). Resolution: `updateLessonProgress()` clamps server-side — percentage 0–100, position ≥0, both rounded to integers and rejected if not finite.

### M5. Media-type lessons can be saved with no file; type/file mismatches unvalidated — **FIXED W2 (client-enforced, server backstop)**
**CODE-VERIFIED.** `lesson-editor.tsx` validate() checked title+link only. Resolution:
- validate() now requires a media source before submit: a newly chosen file, or an intact existing one (stored file / imported stream URL / external key) that hasn't been removed. The "File required" badge uses the same logic.
- Server backstop in `updateLesson()`: saving a media-type lesson whose resulting state has no file, no content, and no external fields is rejected ("Media lessons need a file or an imported source").
- Note: `createLesson()` intentionally stays permissive because the UI creates the lesson first and uploads immediately after; the client validation is the gate for that flow.
- Type→file mismatch validation beyond clearing on type change (below) remains open; accept-list enforcement happens at upload time via bucket mime rules.

### M6. Removing a lesson file or switching content type leaves stale `storage_path`/content in DB — **FIXED W2**
**CODE-VERIFIED.** `lesson-editor.tsx:160-165` cleared local state only; submit never sent `storage_path: null`. Resolution: switching type clears any chosen-but-unsaved file; on save, a stale stored file (removed explicitly, or left behind by a type switch) with **no replacement upload in the same save** is submitted as `storage_path: null`, and `updateLesson()` deletes the orphaned storage object after the DB update succeeds. Imported `external_*` fields are deliberately preserved across edits (only a type switch away from media drops `content`).

### M7. Lesson URL doesn't validate that the lesson belongs to the course — **FIXED W2**
**CODE-VERIFIED.** `lesson/[lessonId]/page.tsx:21-28` fetched independently; cross-course URLs rendered mismatched sidebar/breadcrumbs (`currentIdx=-1`). Resolution: `getLessonContent(lessonId, expectedCourseId?)` verifies `module.course_id === expectedCourseId` and returns "This lesson does not belong to this course."; the lesson page passes the URL's courseId.

### M8. Dashboard card layout can collapse/shrink (your UI report)
**NEEDS INFO.** Student dashboard cards (`FeaturedCard` aspect-[8/3], grid `sm:2/lg:3`) can look cramped/shrunken per your report, but I need a screenshot/viewport width + which state (many courses? long titles? mobile?) to reproduce before proposing a fix. Static analysis found no obvious single cause.

### M9. Poster import — nothing to import (source schema has no poster data) — **RESOLVED W2** (unblocked by C2+C3 fixes)
**LIVE-DATA-VERIFIED.** `apna_videos.db` `courses` table = `id, name, scraped_at` only. There are no poster/thumbnail columns in the source schema, so "poster import doesn't work" is expected — the importer parses only title/description. The manual image-upload fallback in `edit-course-form.tsx` was broken only by C2 (>1MB rejection, fixed W1) and C3 (unusable stored URLs, fixed W2). With migration 010 applied, poster upload works end-to-end. Optional future: add a `thumbnail_url` column to the source-DB spec if future dumps include posters.

### M10. Dead duplicate course-builder component — **DONE W2**
`src/components/course-builder.tsx` (691 lines) deleted; the live builder remains `app/(admin)/admin/courses/[courseId]/builder/course-builder.tsx`.

---

## LOW / HYGIENE

- **L1.** `.env.local.example` holds a real-looking service-role JWT + anon key. Verified untracked/never committed, but rotate if production values; example files get shared.
- **L2.** Storage student policy casts path segment to UUID (`migration 001`) — non-UUID prefixes (e.g. `thumbnails/`) raise cast errors during policy evaluation. Latent today (signed URLs bypass policies); breaks any future direct student storage query.
- **L3.** `/` always redirects to `/login`, even for signed-in users (`middleware.ts:80-82`).
- **L4.** Admin login header hardcodes "LearnForLess", ignores `site_settings.site_name`.
- **L5.** Zod installed but unused; no shared schema validation for Server Action inputs. A single validation layer would have prevented several items above.

---

## Suggested fix order

1. ~~C1 Part A~~ — DONE W1 (migration 008 applied + verified)
2. ~~C1 Part B~~ — DONE W1
3. ~~C2~~ — DONE W1
4. ~~H2~~ — DONE W1
5. ~~C4~~ — DONE W2 (**apply migration 009**)
6. ~~C3~~ — DONE W2 (**apply migration 010**)
7. ~~M1 diagnostics — pin down PDF failure case~~ — DONE W3 (root cause: missing B2 bucket CORS rules; rule applied via b2_update_bucket, verified in real flow)
8. ~~H3 — reproduce on an enrolled student~~ — DONE W3 (root cause: `.in()` progress fetch exceeded Supabase URL limit on 785-lesson course → silent 400 → empty progress map; replaced with single embedded FK query, verified end-to-end)
9. Everything else — DONE W2 except M8 (needs screenshot/viewport info)
