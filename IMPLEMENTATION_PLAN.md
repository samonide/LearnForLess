# IMPLEMENTATION_PLAN.md

Living roadmap. Read with `PROJECT_CONTEXT.md` at session start.

## CURRENT STATE (verified 2026-08-19)

- App on Next.js 16.3 / React 19 / Supabase.
- Phase 0 — Stabilization + docs cleanup DONE.
- Phase 1 — Auth (registration, login, password recovery, token redemption) DONE.
- Phase 2 — CMS improvements (cover image upload, duplicate title prevention, reorder modules/lessons) DONE.
- Phase 3 — UI/UX redesign (zen, minimal, calm, premium; charcoal dark) COMPLETE (2026-08-19).
- Phase 4 — CMS Functional Completion COMPLETE (2026-08-19).
- Phase 5 — Security Foundation COMPLETE (2026-08-19).
- 57 integration tests (7 authz-security + 18 auth-flow + 32 CMS CRUD) — all pass.
- 11 Playwright E2E tests (4 spec files) — all pass.
- `tsc --noEmit` passes. `npm run build` passes.

## COMPLETED WORK

### Phase 0 — Stabilization + Docs Cleanup

- Token bug fix: `access_tokens.bound_user_id` added via migration 002 and backfilled; query now succeeds; single-owner token binding enforced in updated `redeem_access_token` RPC.
- Docs cleaned: stale `DEMO_SETUP.md`, `QUICK_START.md`, `FRONTEND_STATUS.md` removed; `README.md` rewritten; `PROJECT_CONTEXT.md` created.

### Phase 1 — Authentication

- Student registration: username + password + access token redemption.
- Student login: username + password via Supabase Auth.
- Authenticated token redemption: `redeemTokenAuthenticated()` server action, `TokenRedeemForm` on dashboard.
- Password recovery: admin issues one-time recovery token at `/admin/users`; student resets at `/recover` with username + token + new password. Recovery tokens hashed (SHA-256), single-use, 24h expiry, enumeration-safe.
- Routing: unauthenticated → `/login`, authenticated → `/dashboard`.
- Migrations 003 (username_auth) and 004 (recovery_tokens) applied to hosted Supabase.

### Phase 2 — CMS Improvements

- Cover image upload: file picker + `uploadCourseThumbnail` server action. Images stored in `course-materials/thumbnails/` via Supabase Storage.
- Duplicate title prevention: case-insensitive uniqueness checks in `createCourse`/`updateCourse` (global), `createModule`/`updateModule` (per-course), `createLesson`/`updateLesson` (per-module).
- Module/lesson reordering: `reorderModules()` and `reorderLessons()` server actions with up/down buttons in the course builder UI.
- Course/module/lesson CRUD, ordering, course builder UI functional.

### Phase 3 — UI/UX Redesign (zen, minimal, calm, premium; charcoal dark)

- **Foundation**: Two-family type Geist + Literata; cool charcoal tokens (dark primary); Geist/Literata/Geist Mono wired in root layout; `.prose-lesson` Literata reading surface (17px, 1.75 lh, 65ch, dark weight 450).
- **Student experience**: Dashboard, course viewer, lesson/reading redesigned. Newsreader out, ring-cards → border + shadow, cool-charcoal sidebar, frosted top-bar, Literata reading surface.
- **Admin shell + dashboard**: Root `<html className="dark">` locks charcoal dark; sidebar de-warmed, frosted header, hairline-grid metric summary + bordered tables.
- **Course CMS**: Hairline-grid bordered panels, plain headings, shadow-card removed.
- **Remaining admin surfaces**: Tokens, users, settings → bordered hairline-grid panels. Dark palette retuned: bg `oklch(0.18 0.006 260)`, card `0.21`, primary `oklch(0.70 0.05 220)`.
- **Auth surfaces**: Student login/register/recover + admin login. Legacy `/access` removed. Bordered dark panels, plain Geist headings.
- **Visual QA**: Full Playwright pass across auth/public surfaces (desktop 1280 + mobile 390, dark). All 200, no overflow, no console errors, focus rings present, buttons ≥40px.
- **Status**: COMPLETE (2026-08-19). `tsc --noEmit` + `npm run build` pass across all stages.

### Phase 4 — CMS Functional Completion

All manual CMS → student learning workflows verified end-to-end.

**Completed items:**
- Cover image upload (file picker + `uploadCourseThumbnail` server action, Supabase Storage)
- Duplicate title prevention (case-insensitive, all CRUD operations)
- Module/lesson reordering (up/down buttons, server actions)
- Course overview page (replaced unconditional redirect, `/course/[courseId]`)
- CourseViewer sidebar "Course" breadcrumb link
- Video progress/resume tracking (throttled `timeupdate` → `updateLessonProgress`, seek to `last_position`)
- Bug A fix: `getLessonContent` PostgREST relation shape mismatch (object vs array)
- Bug B fix: course overview redirect → real overview page
- Single-source media enforcement (URL/file toggle in lesson modal)
- hls.js video player for M3U8/HLS + native MP4 fallback
- Student lesson breadcrumb (module title + lesson position)
- Media source precedence collision resolved (toggle clears the other source)
- Dead code removed (`lesson-content.tsx`, legacy `/access` flow, unauthenticated `redeemToken()`)

**Audit (2026-08-19):** No Category 1 (blocks students) or Category 2 (breaks CMS) blockers remain.

### Phase 5 — Security Foundation

**Migration 005 — RPC/RLS security fixes:**
- `get_course_progress` RPC: added `auth.uid()` guard — students can only query their own progress; admins retain access to inspect any student's progress.
- `grant_course_access_admin` RPC: removed `p_admin_id` parameter — authorizes via `auth.uid()` + profiles role check. Updated caller in `src/actions/admin/users.ts`.
- `lesson_progress` UPDATE policy: added `student_has_course_access()` check to both USING and WITH CHECK clauses, matching the existing INSERT policy protection.

**Test harness:**
- `vitest.config.ts` — Vitest 4 config, `tests/**/*.test.ts` glob, `@/` path alias, loads `.env.local`.
- `tests/integration/setup.ts` — helpers: `getServiceClient()`, `createAuthedClient()`, `createTestUser()`, `seedTestCourse()`, `assignStudentToCourse()`, `revokeStudentCourseAccess()`, `cleanupTestData()`.
- `tests/integration/authz-security.test.ts` — 7 tests (RPC guards, RLS policies, admin bypass).
- `tests/integration/auth-flow.test.ts` — 18 tests (registration, login, token redemption, single-owner binding, error cases).
- `tests/integration/cms-crud.test.ts` — 32 tests (course/module/lesson CRUD, status transitions, reordering, RLS enforcement).
- Total: 57 integration tests, all pass against live hosted Supabase.

**Playwright E2E browser tests:**
- `tests/e2e/helpers.ts` — re-exports from integration setup + `seedMultiLessonCourse()`, `hashToken()`, `createTestToken()`, `cleanupE2EData()`.
- `tests/e2e/auth-flow.spec.ts` — 3 tests: register, login, empty dashboard.
- `tests/e2e/token-redemption.spec.ts` — 1 test: redeem token and see course on dashboard.
- `tests/e2e/student-courses.spec.ts` — 4 tests: course overview, lesson complete, link lesson, prev/next nav.
- `tests/e2e/admin.spec.ts` — 3 tests: admin login, dashboard metrics, courses list.
- Total: 11 E2E tests, all pass in Chromium (1 worker, 60s timeout, webServer auto-start).

**Verification:** `tsc --noEmit` + `npm run build` confirm no regressions.

**Status:** COMPLETE (2026-08-19).

## ROADMAP

### Phase 6 — Product Completion (REQUIRED BEFORE PUBLISHING)

Purpose: Address the minimum requirements to publish this application.

Tasks:
- Verify migration 005 was applied to hosted Supabase (SQL Editor confirmation)
- Verify auth proxy works in production deployment
- Create DEPLOYMENT.md: Supabase project setup, required env vars, migration order, storage bucket config, Vercel/deployment steps
- Create tests/README.md: how to run Playwright tests, integration tests, test DB setup, environment variables
- Review/update .env.local.example for production
- Update README.md with current test suite and migration info

Dependencies: None. All code work is done.
Required before publishing: YES.

### Phase 7 — Product Features (HIGH-VALUE)

Purpose: Address real usability gaps that improve the product experience.

Tasks:
- Dashboard N+1 query optimization: batch `getNextUnfinishedLesson()` calls into a single query or join
- Admin progress visibility: student progress view in admin user management
- PDF/text scroll tracking: send scroll position on unmount for resume
- Signed URL expiration handling: refresh or regenerate signed URLs for storage-backed lessons before expiry
- Orphaned storage file cleanup: delete file from storage when lesson source is toggled away from file mode
- Student registration rate limiting: IP-based or CAPTCHA

Dependencies: Phase 6 should be completed first (deployment sorted).
Required before publishing: NO.

### Phase 8 — Production Hardening (INFRASTRUCTURE)

Purpose: Operational readiness for a live deployment with real users.

Tasks:
- Backup/recovery procedures
- Monitoring/alerting (error tracking, uptime)
- Logging/auditing review
- Performance review and optimization
- Security review

Dependencies: Phase 6 (deployment), Phase 7 (product features stable).
Required before publishing: NO. Recommended before significant user adoption.

### Phase 9 — Database Import (LAST, DEFERRED)

Purpose: Import existing course data from a .db file.

- **Blocked** until: real source `.db` schema available, media-source architecture finalized, security/storage requirements understood.
- Do NOT implement speculative import architecture. Do not invent columns, mappings, media types, encryption mechanisms, or import behavior without the real source data.
- When unblocked: admin uploads `.db` file, inspect safely, map to course data model, prevent duplicates, preserve ordering, validate before commit, atomic import.

Required before publishing: NO.

## Deferred / Future (no assigned phase)

- Future media providers (Buzzheavier, PixelDrain)
- UI/design polish beyond current Phase 3 state
- Broader performance optimization

## Security notes

Service-role key server-only; never expose password/token/recovery hashes; server-side authz for admin ops; RLS + constraints; validate server-side; uploaded files untrusted.

## Next session prompt

"Continue LearnForLess development. Read PROJECT_CONTEXT.md and IMPLEMENTATION_PLAN.md. All phases through Phase 5 (Security Foundation) are complete. The next work is Phase 6 (Product Completion — REQUIRED BEFORE PUBLISHING). Do NOT skip to Phases 7-9. Do not redo completed work."