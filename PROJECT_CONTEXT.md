# PROJECT_CONTEXT.md

Compact context for future AI sessions. Load this + `IMPLEMENTATION_PLAN.md` first.

## What LearnForLess is

Full-stack course CMS + student learning platform. Admins create/manage courses, modules, lessons, and issue per-student access tokens. Students redeem tokens for course access and track lesson progress.

## Stack

Next.js 16.3, React 19, TypeScript, Tailwind 4, Supabase (Postgres, Auth, Storage, RLS), Radix UI / shadcn / Base UI, React Hook Form, Zod, Tiptap, dnd-kit, Lucide, date-fns, bcryptjs (installed, not yet used for plaintext migration).

## Architecture

- App Router. Admin routes under `src/app/(admin)/admin/*` (`/admin/tokens`, `/admin/courses`, `/admin/users`, etc). Student routes under `(student)`.
- Server Actions in `src/actions/*`, Supabase helpers in `src/lib/supabase/*`, UI in `src/components/ui/*`.
- DB: `supabase/migrations/001_schema.sql` (full), `002_token_student_accounts.sql` (token binding). Optional `seed.sql`.
- `src/types/database.ts` is currently `Database = any` placeholder, not generated types.

## Admin portal

- Token management at `/admin/tokens` — list, generate, toggle active, edit, delete, manage token<->course links. Generation creates `access_tokens` row + Supabase Auth user (`email = token-id@tokens.local` via `buildStudentTokenLoginEmail`) + `token_courses` + `user_courses` + `student_access` + `profiles` + `audit_logs`.
- Course/module/lesson CRUD, user management.

## Student portal

- Courses listing, course/lesson view, progress. Access gated by `user_courses` / RLS helpers `is_admin()`, `student_has_course_access()`.

## Auth state (current, verified 2026-08-18)

- Supabase Auth. `profiles.role` in `('admin','student')`. Trigger `handle_new_user` creates profile on `auth.users` insert.
- Access tokens: `access_tokens` stores only `token_hash` (never raw token). Raw token shown once at generation. RPC `redeem_access_token(p_token_hash, p_user_id)` grants access. After migration 002, tokens have `bound_user_id` (FK -> `profiles.id ON DELETE SET NULL`) enforcing single-owner binding; RPC updated to enforce `token_assigned_to_another_student`. `student_access(token_id)` is now `UNIQUE`.
- Student username/password login (Phase 1): `profiles.username` (partial unique index, migration 003) + synthetic email `student-{username}@learnforless.local`. Accounts must first be created via Supabase Auth `admin.createUser` (server action `registerStudent`), then profile upsert with username. Login resolves username -> profile id, then signs in with derived email. Password never stored plaintext — Supabase Auth handles hashing.
- `/login` = username+password sign-in; `/register` = create account; `/access` = legacy token redemption (standalone, for unauthenticated users); dashboard = inline token redemption for authenticated users.
- Authenticated token redemption: `redeemTokenAuthenticated()` in `src/actions/student/access.ts` — gets current user from session, validates token, calls `redeem_access_token` RPC which binds token to user, assigns courses, upserts profile. No new auth user created. `TokenRedeemForm` component on dashboard (empty state + persistent "Redeem Another Token" section).
- No password recovery yet. `bcryptjs` present but not wired (Supabase Auth manages password hashing).

## Course / material model

`courses` (slug unique, status draft/published/archived, sort_order) -> `modules` (course_id, sort_order) -> `lessons` (module_id, content_type in pdf/video/text/link/image/file, content, storage_path, is_preview, sort_order). `token_courses` links tokens to courses, `user_courses` links users to courses (with `granted_by_token`), `lesson_progress` tracks per-user lesson completion.

## Database / storage

- Postgres via Supabase. RLS enabled on all tables. Indexes on hash/slug/sort/user.
- Storage bucket `course-materials` (private, 500MB, allow-listed mime types). RLS: admin full, students read only via `student_has_course_access((name split)[1])`.
- `npm run lint` shows many pre-existing warnings/errors (no-img-element, no-explicit-any, etc) unrelated to Phase 0. `tsc --noEmit` passes.

## Security rules

- Never expose service-role key, password hashes, token hashes, recovery-token hashes, private storage creds.
- Never rely only on client checks; server-side authz required.
- Validate backend input server-side. Treat uploaded files/`.db` files as untrusted. Do not execute arbitrary code from uploads.
- Never store passwords plaintext. Recovery tokens hashed/single-use when introduced.
- RLS + `SECURITY DEFINER` functions for sensitive flows.

## Conventions

- Next.js 16.3 — do not downgrade.
- Prefer existing deps before adding new.
- `CLAUDE.md` and `AGENTS.md` authoritative; do not delete them.
- Migrations applied manually via Supabase Dashboard SQL Editor (no linked Supabase CLI).

## Verified (2026-08-18)

- `access_tokens.bound_user_id` exists; backfill from `student_access` applied; `getTokensWithCourses` query works; `/admin/tokens` no longer errors; token generation path references `bound_user_id`.
- `tsc --noEmit` passes. `npm run build` not run in this session (lint/build verification deferred per Phase 0 scope).

## Known limitations / unresolved

- Pre-existing lint issues (54 errors, 35 warnings) not addressed in Phase 0.
- Generated Supabase types not in use (`Database = any`).
- Production hardening (backup, logging, monitoring) not yet done.
