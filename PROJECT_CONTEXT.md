# PROJECT_CONTEXT.md

Compact context for future AI sessions. Load this + `IMPLEMENTATION_PLAN.md` first.

## What LearnForLess is

Full-stack course CMS + student learning platform. Admins create/manage courses, modules, lessons, and issue per-student access tokens. Students redeem tokens for course access and track lesson progress.

## Stack

Next.js 16.3, React 19, TypeScript, Tailwind 4, Supabase (Postgres, Auth, Storage, RLS), Radix UI / shadcn / Base UI, React Hook Form, Zod, Tiptap, dnd-kit, Lucide, date-fns, bcryptjs (installed, not yet used for plaintext migration).

## Architecture

- App Router. Admin routes under `src/app/(admin)/admin/*` (`/admin/tokens`, `/admin/courses`, `/admin/users`, etc). Student routes under `(student)`. Public routes under `(public)`.
- Server Actions in `src/actions/*`, Supabase helpers in `src/lib/supabase/*`, UI in `src/components/ui/*`.
- DB: `supabase/migrations/001_schema.sql` (full), `002_token_student_accounts.sql` (token binding), `003_username_auth.sql` (username login), `004_recovery_tokens.sql` (password recovery), `005_security_fixes.sql` (RPC/RLS security fixes), `006_site_settings.sql` (site_settings singleton for branding), `007_course_imports.sql` (importer source columns + course_imports bookkeeping). Optional `seed.sql`.
- `src/types/database.ts` is currently `Database = any` placeholder, not generated types.

## Admin portal

- Sidebar nav (7 items): Dashboard, Courses, Access Tokens, User Directory, Auto Course Importer, Admin Accounts, Settings.
- Token management at `/admin/tokens` — list, generate, toggle active, edit, delete, manage token<->course links. Generation creates `access_tokens` row (token_hash, token_hint, created_by, name, etc.) + `token_courses` + `audit_logs`. Does NOT create auth users, profiles, user_courses, or student_access. `bound_user_id` is NULL until a student redeems.
- Course/module/lesson CRUD, user management, course builder with reordering, cover image upload.
- Auto Course Importer at `/admin/import` — upload SQLite `.db`, inspect parsed preview, incremental or replacement import (DBI phases).
- Admin Accounts at `/admin/admins` — list admins, search students, promote/demote roles (`src/actions/admin/admins.ts`). Server-side guard: cannot demote the last admin.
- Site settings at `/admin/settings` — branding fields (site_name, slogan, logo_url, footer_text, support_email) written to `site_settings` singleton via `updateSiteSettings()`. Consumed by all layouts via `getSiteSettings()` in `src/lib/site-settings.ts`; public read policy, admin-only update (`is_admin()`).
- Admin dashboard with metrics (Courses, Modules, Lessons, Active Tokens, Students).

## Student portal

- Registration (username + password), login (username + password), password recovery.
- Authenticated token redemption on dashboard.
- Course listing grouped by progress (In Progress, Not Started, Completed).
- Course overview with modules/lessons list and completion state.
- Lesson viewer: text (Tiptap), video (HLS/MP4), PDF, link, image, file.
- Video resume tracking (throttled timeupdate, seek to last_position).
- Mark as Complete, Prev/Next navigation, breadcrumb.

## Auth state (current, verified 2026-08-19)

- Supabase Auth. `profiles.role` in `('admin','student')`. Trigger `handle_new_user` creates profile on `auth.users` insert.
- Access tokens: `access_tokens` stores only `token_hash` (never raw token). Raw token shown once at generation. RPC `redeem_access_token(p_token_hash, p_user_id)` grants access. After migration 002, tokens have `bound_user_id` (FK -> `profiles.id ON DELETE SET NULL`) enforcing single-owner binding; RPC updated to enforce `token_assigned_to_another_student`. `student_access(token_id)` is now `UNIQUE`.
- Student username/password login: `profiles.username` (partial unique index, migration 003) + synthetic email `student-{username}@learnforless.local`. Accounts must first be created via Supabase Auth `admin.createUser` (server action `registerStudent`), then profile upsert with username. Login resolves username -> profile id, then signs in with derived email. Password never stored plaintext — Supabase Auth handles hashing.
- `/login` = username+password sign-in; `/register` = create account; dashboard = inline token redemption for authenticated students. Legacy standalone `/access` flow removed (2026-08-19).
- Authenticated token redemption: `redeemTokenAuthenticated()` in `src/actions/student/access.ts` — gets current user from session, validates token, calls `redeem_access_token` RPC which binds token to the existing student (`bound_user_id`), assigns courses, upserts profile. `TokenRedeemForm` on dashboard. Generation and redemption are fully separate; redemption never gets a token-created account.
- Manual course grant: `grantCourseAccess()` in `src/actions/admin/users.ts` uses the authenticated client from `getAdminUser()` to call `grant_course_access_admin` RPC (which authorizes via `auth.uid()` plus profiles role check).
- Password recovery: `recovery_tokens` table (migration 004) stores only SHA-256 `token_hash` + `username` + `expires_at` (24h) + `used_at` (single-use), admin-only RLS. Admin issues one-time token at `/admin/users`. Student consumes at `/recover` (username + token + new password). Enumeration-safe (unknown usernames return fake success). FIXED 2026-08-22: mark-as-used filter used `.eq("used_at", null)` (invalid PostgREST cast → every redemption failed with `unknown_error`); now `.is("used_at", null)`. Regression coverage in `tests/integration/recovery-token.test.ts` (5 tests incl. real sign-in verification).
- Auth redirects handled by Next.js proxy (middleware): unauthenticated → /login, /admin → /admin/login.
- Migrations 003, 004, 005 applied to hosted Supabase and verified.

## Course / material model

`courses` (slug unique, status draft/published/archived, sort_order) -> `modules` (course_id, sort_order) -> `lessons` (module_id, content_type in pdf/video/text/link/image/file, content, storage_path, is_preview, sort_order). `token_courses` links tokens to courses, `user_courses` links users to courses (with `granted_by_token`), `lesson_progress` tracks per-user lesson completion.

## Media architecture (current, verified 2026-08-19)

External URLs are the primary media source. Video = third-party M3U8/HLS URLs. PDF/downloadable/code = direct Backblaze URLs. GoFile = backup for PDF/code. All stored in `lessons.content`. `lessons.storage_path` is an admin-upload path for Supabase Storage — secondary source. Client-side: `signed_url || content` (signed URL from storage takes precedence when present). No provider names in code — only in DB data. Course-builder lesson modal enforces single media source via "External URL" / "Upload File" toggle. Video playback: Video.js with @videojs/http-streaming for HLS, fallback for MP4. Dark theme. Signed URLs from Supabase Storage expire after 1 hour (no refresh logic yet). Imported PDF/code files: B2 presigned URL generated at view time via `generateB2PresignedUrl()` in `src/lib/importer/resolve-source.ts`, returned through `signed_url` field from `getLessonContent()`. No viewer changes needed.

## Database / storage

- Postgres via Supabase. RLS enabled on all tables. Indexes on hash/slug/sort/user.
- Storage bucket `course-materials` (private, 500MB, allow-listed mime types). RLS: admin full, students read only via `student_has_course_access((name split)[1])`.
- `npm run lint` shows many pre-existing warnings/errors (no-img-element, no-explicit-any, etc). `tsc --noEmit` passes.

## Security rules

- Never expose service-role key, password hashes, token hashes, recovery-token hashes, private storage creds.
- Never rely only on client checks; server-side authz required.
- Validate backend input server-side. Treat uploaded files as untrusted. Do not execute arbitrary code from uploads.
- Never store passwords plaintext. Recovery tokens hashed/single-use.
- RLS + `SECURITY DEFINER` functions for sensitive flows.
- Phase 5 (migration 005): `get_course_progress` RPC has `auth.uid()` guard; `grant_course_access_admin` authorizes via `auth.uid()` + profiles role check; `lesson_progress` UPDATE policy includes `student_has_course_access()` check.

## Design system (current, verified 2026-08-19)

- Aesthetic: zen, minimal, calm, premium, highly intentional.
- Typography: two-family. Geist for all UI and headings; Literata (screen-reading serif) for lesson reading content only — 17px, 1.75 line-height, 65ch measure, dark-mode variable weight 450.
- Color: charcoal-based dark mode as PRIMARY target. Cool charcoal neutrals (hue ~260; dark `--background: oklch(0.16 0.005 260)`), slate-blue primary (hue ~220). Light mode derived from same tokens, kept functional only.
- Subtle borders, restrained chrome, cards representing real content.
- Product focus: course CMS + learning platform — not generic SaaS dashboard.
- Design workflow: Design with Intent → Impeccable → Playwright.

## Superseded UI Direction (old "Phase 5" warm editorial)

The previous design direction (warm editorial palette, periwinkle primary, Newsreader headings, ring-based cards) was applied across all stages and verified functional. This direction was replaced by Phase 3 (zen, minimal, charcoal dark). Do not revive the old direction.

## Verified (2026-08-19)

- Phase 0: Stabilization + Docs Cleanup — COMPLETE.
- Phase 1: Authentication — COMPLETE. All flows verified.
- Phase 2: CMS Improvements — COMPLETE. Cover image upload, duplicate title prevention, reordering all verified.
- Phase 3: UI/UX Redesign — COMPLETE. All surfaces redesigned and Playwright-visual-QA'd.
- Phase 4: CMS Functional Completion — COMPLETE. All CMS → student workflows operational. No Category 1-2 blockers.
- Phase 5: Security Foundation — COMPLETE. Migration 005 applied. 57 integration tests + 11 Playwright E2E tests, all passing.
- UI-A: Navigation + Edge States — COMPLETE (2026-08-20). Admin sidebar active nav state, 13 loading/error/not-found boundary files. 11 Playwright E2E tests verify all surfaces.
- UI-B: Responsive + Accessibility — COMPLETE (2026-08-20). Admin mobile sidebar (Sheet drawer), table overflow-x-auto on 5 tables, 44px touch targets, auth card padding, viewport meta, focus indicators, dashboard cards at 320px, lesson viewer Sheet overflow fix.
- UI-C: Design Consistency — COMPLETE (2026-08-20). All ring→border replacements (16 files), decorative "CMS"/"Admin" labels removed, section label typography fixed per DESIGN.md. `tsc --noEmit` + `npm run build` pass.
- Course overview page: `/course/[courseId]` displays header, progress bar, modules/lessons list with completion state.
- Video progress/resume: Video.js player with dark theme, throttled timeupdate (15s), seek to last_position, cap at 99%. HLS via @videojs/http-streaming, MP4 via native. `fill: true` + wrapper `aspect-video` + `key={lessonId}` remount on nav (fixed first-nav/controls bugs).
- PDF viewer: react-pdf with page navigation, zoom (0.5x-2.5x), fullscreen, download. Dark-theme integrated.
- Student lesson breadcrumb: module title + "Lesson N of M".
- Legacy code removed: `lesson-content.tsx`, `/access` flow, unauthenticated `redeemToken()`.
- UI-E: Design Polish + Micro-interactions — COMPLETE (2026-08-20). Progress bar animation (500ms), skeleton component (video/pdf), Sonner toast theming, dashboard empty-state illustration (SVG). All verified `tsc --noEmit` + `npm run build`.
- `tsc --noEmit` passes. `npm run build` passes.

## Known limitations / unresolved

- Pre-existing lint issues (61 errors, 52 warnings as of 2026-08-22) not addressed.
- Generated Supabase types not in use (`Database = any`).
- Dashboard N+1 query: `getNextUnfinishedLesson()` called per-course in a loop.
- Signed URL expiration: 1-hour expiry from Supabase Storage, no refresh logic.
- No admin progress visibility in UI (requires DB query).
- No PDF/text scroll tracking.
- No orphaned storage file cleanup (file remains when source toggled away).
- No student registration rate limiting.
- No deployment documentation.
- No test documentation.
- Phase 7 (Product Features) and Phase 8 (Production Hardening) not started.
- Phase 9 (Database Import) deferred — blocked until real source `.db` schema available. Do not start.
- Phase DBI-1 — DB Course Importer foundation COMPLETE (2026-08-21): migration 007, parser foundation in `src/lib/importer/parse.ts`, importer types, sql.js dependency. 4 parser unit tests pass.
- Phase DBI-2 — Server-side import action COMPLETE (2026-08-21): `importCourse()` admin-only server action + `executeImport()` testable core in `src/actions/admin/import-course.ts`. 4 integration tests (guard-skipped when migration 007 not applied). 73 tests total pass.
- Phase DBI-3 — Media/source resolution COMPLETE (2026-08-21): B2 presigned URL generation for imported PDF/code files; `getLessonContent()` resolves via `signed_url` with Buzzheavier fallback; no viewer/schema changes. 10 resolve-source tests pass (7 unit + 3 integration). `tsc --noEmit` + `npm run build` pass.
- Phase DBI-4 — Re-Import Engine COMPLETE (2026-08-21): `executeImport()` incremental (modules by `source_chapter_num`, lessons by `source_fingerprint`, add missing only) + replacement (preserves course row/manual data, recreates imported modules/lessons) modes. Manual rollback both. `importCourse()` accepts `mode`. 13 new integration tests (6+7). `tsc --noEmit` + `npm run build` pass. Full test suite deferred until DBI-5.
- Phase DBI-5 — Auto Course Importer UI COMPLETE (2026-08-22): Admin sidebar nav item + `/admin/import` page. `parseImport()` server action (read-only, no DB writes). Upload/inspection/import workflow: dropzone, course preview (source ID/type, module/lesson counts by type, module list, warnings), incremental vs replacement import with AlertDialog confirmation, success summary with course builder link. Reuses DBI-2/DBI-4 actions. `tsc --noEmit` + `npm run build` pass.
- Full project audit (2026-08-22): `tsc --noEmit` passes; `npm run build` passes (23 routes); all 96 Vitest tests pass against live Supabase (85 integration + 11 unit); E2E suite is 28 tests across 7 spec files. Docs reconciled with code (migrations 006/007, site settings branding, admin accounts page, test counts).
- Recovery token fix + dead code removal (2026-08-22): root-caused broken `/recover` flow (PostgREST `.eq("used_at", null)` cast error), fixed to `.is()`, added `tests/integration/recovery-token.test.ts` (5 tests). Deleted 3 stale component duplicates in `src/components/` (764 lines). Full suite: 101 Vitest tests pass. `tsc --noEmit` + `npm run build` pass.

## Conventions

- Next.js 16.3 — do not downgrade.
- Prefer existing deps before adding new.
- `CLAUDE.md` authoritative; do not delete it.
- Migrations applied manually via Supabase Dashboard SQL Editor (no linked Supabase CLI).