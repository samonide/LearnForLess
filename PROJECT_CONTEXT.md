# PROJECT_CONTEXT.md

Compact context for future AI sessions. Load this + `IMPLEMENTATION_PLAN.md` first.

## What LearnForLess is

Full-stack course CMS + student learning platform. Admins create/manage courses, modules, lessons, and issue per-student access tokens. Students redeem tokens for course access and track lesson progress.

## Stack

Next.js 16.3, React 19, TypeScript, Tailwind 4, Supabase (Postgres, Auth, Storage, RLS), Radix UI / shadcn / Base UI, React Hook Form, Zod, Tiptap, dnd-kit, Lucide, date-fns, bcryptjs (installed, not yet used for plaintext migration).

## Architecture

- App Router. Admin routes under `src/app/(admin)/admin/*` (`/admin/tokens`, `/admin/courses`, `/admin/users`, etc). Student routes under `(student)`. Public routes under `(public)`.
- Server Actions in `src/actions/*`, Supabase helpers in `src/lib/supabase/*`, UI in `src/components/ui/*`.
- DB: `supabase/migrations/001_schema.sql` (full), `002_token_student_accounts.sql` (token binding), `003_username_auth.sql` (username login), `004_recovery_tokens.sql` (password recovery), `005_security.sql` (RPC/RLS security fixes). Optional `seed.sql`.
- `src/types/database.ts` is currently `Database = any` placeholder, not generated types.

## Admin portal

- Token management at `/admin/tokens` — list, generate, toggle active, edit, delete, manage token<->course links. Generation creates `access_tokens` row + Supabase Auth user (`email = token-id@tokens.local` via `buildStudentTokenLoginEmail`) + `token_courses` + `user_courses` + `student_access` + `profiles` + `audit_logs`.
- Course/module/lesson CRUD, user management, course builder with reordering, cover image upload.
- Admin dashboard with metrics (Courses, Modules, Lessons, Active Tokens, Students).
- Settings page.

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
- Authenticated token redemption: `redeemTokenAuthenticated()` in `src/actions/student/access.ts` — gets current user from session, validates token, calls `redeem_access_token` RPC which binds token, assigns courses, upserts profile. `TokenRedeemForm` on dashboard.
- Password recovery: `recovery_tokens` table (migration 004) stores only SHA-256 `token_hash` + `username` + `expires_at` (24h) + `used_at` (single-use), admin-only RLS. Admin issues one-time token at `/admin/users`. Student consumes at `/recover` (username + token + new password). Enumeration-safe (unknown usernames return fake success).
- Auth redirects handled by Next.js proxy (middleware): unauthenticated → /login, /admin → /admin/login.
- Migrations 003, 004, 005 applied to hosted Supabase and verified.

## Course / material model

`courses` (slug unique, status draft/published/archived, sort_order) -> `modules` (course_id, sort_order) -> `lessons` (module_id, content_type in pdf/video/text/link/image/file, content, storage_path, is_preview, sort_order). `token_courses` links tokens to courses, `user_courses` links users to courses (with `granted_by_token`), `lesson_progress` tracks per-user lesson completion.

## Media architecture (current, verified 2026-08-19)

External URLs are the primary media source. Video = third-party M3U8/HLS URLs. PDF/downloadable/code = direct Backblaze URLs. GoFile = backup for PDF/code. All stored in `lessons.content`. `lessons.storage_path` is an admin-upload path for Supabase Storage — secondary source. Client-side: `signed_url || content` (signed URL from storage takes precedence when present). No provider names in code — only in DB data. Course-builder lesson modal enforces single media source via "External URL" / "Upload File" toggle. Video playback: hls.js for M3U8/HLS, native for MP4. Signed URLs from Supabase Storage expire after 1 hour (no refresh logic yet).

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
- Course overview page: `/course/[courseId]` displays header, progress bar, modules/lessons list with completion state.
- Video progress/resume: hls.js player, throttled timeupdate (15s), seek to last_position, cap at 99%.
- Student lesson breadcrumb: module title + "Lesson N of M".
- Legacy code removed: `lesson-content.tsx`, `/access` flow, unauthenticated `redeemToken()`.
- `tsc --noEmit` passes. `npm run build` passes.

## Known limitations / unresolved

- Pre-existing lint issues (54 errors, 35 warnings) not addressed.
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

## Conventions

- Next.js 16.3 — do not downgrade.
- Prefer existing deps before adding new.
- `CLAUDE.md` authoritative; do not delete it.
- Migrations applied manually via Supabase Dashboard SQL Editor (no linked Supabase CLI).