# IMPLEMENTATION_PLAN.md

Living roadmap. Read with `PROJECT_CONTEXT.md` at session start.

## CURRENT STATE (verified 2026-08-18)

- App on Next.js 16.3 / React 19 / Supabase.
- `/admin/tokens` bug fixed: `access_tokens.bound_user_id` added via migration 002 and backfilled; query now succeeds; single-owner token binding enforced in updated `redeem_access_token` RPC.
- Docs cleaned: stale `DEMO_SETUP.md`, `QUICK_START.md`, `FRONTEND_STATUS.md` removed; `README.md` rewritten; `PROJECT_CONTEXT.md` created.
- Phase 1 Auth (registration + login foundation) DONE: `profiles.username` via migration 003 (partial unique index); `registerStudent`/`loginStudent` server actions in `src/actions/student/auth.ts` (uses synthetic email `student-{username}@learnforless.local` in Supabase Auth, password stored by Supabase Auth — never plaintext); `/login` replaced with username+password form; new `/register` page; middleware redirects unauthenticated -> `/login`, root -> `/login`; student layout shows `username`; dashboard empty state explains access-token redemption. `tsc --noEmit` passes. `npm run build` passes.
- Phase 1 Token redemption for authenticated students DONE: `redeemTokenAuthenticated` server action in `src/actions/student/access.ts` binds token to the currently logged-in user (instead of creating a new auth user); `TokenRedeemForm` client component embedded in dashboard empty state and as a persistent "Redeem Another Token" section. Reuses existing `redeem_access_token` RPC. `tsc --noEmit` passes. `npm run build` passes.
- Migration 003 must be applied to hosted Supabase (Supabase Dashboard SQL Editor) before login works.

## COMPLETED

- Phase 0 — stabilization + docs cleanup: token bug fix verified, type check passes.
- Phase 1 (foundation) — registration + login (username/password). Remaining Phase 1 items: password recovery, `/recover` page.

## CURRENT

- Phase 1 — Authentication. Registration + login foundation done. Token redemption for authenticated users done. Password recovery (`/recover`) not started; begin on explicit next-session prompt.

## NEXT

- Phase 1 — Authentication (do not start automatically; begin on explicit next-session prompt).

## FUTURE

### Phase 1 — Authentication (not started)

- Student registration: `username`, `password`, `access token` (token single-use for redemption; grants course access).
- Student login: `username` + `password`.
- Routing: unauthenticated -> `/login`, authenticated -> `/dashboard`.
- Dashboard: empty state when no courses; explain need for access token; each token single-use for its redemption purpose.
- Password recovery: student contacts admin, admin issues recovery token, student visits `/recover` with `username` + `recovery token`, sets new password.
- Recovery tokens: securely generated, hashed/single-use, invalidated after use, protected from unauthorized access.
- Passwords never plaintext.

### Phase 2 — CMS improvements (not started)

- Every course has cover image. Improve course/module/lesson management. Manually add modules/lessons to existing courses. Reorder modules/lessons. Prevent duplicate courses/modules/lessons where appropriate.

### Phase 3 — Course database import (not started)

- Admin uploads `.db` file. Inspect safely, identify tables/data, map to video/PDF/downloadable/other. Identify multiple courses via slug. Admin chooses course(s) to import. No blind duplication of existing courses/modules/lessons/materials. Preserve ordering/relationships. Validate before commit. Prefer atomic/transactional import (failed import leaves no partial data). Treat uploaded `.db` as untrusted input. Never execute arbitrary code from uploaded DB.

### Phase 4 — Course materials (not started)

- Three primary categories: Video, PDF, downloadable code/other files/links. Redesign video player, improve PDF viewing, improve file handling. Integrate progress/completion tracking. Only authorized students access protected materials.
- Do not blindly hash URLs if original URL needed later — choose correct mechanism at that time (signed URLs / encrypted values / server mappings / storage paths / etc) based on actual storage architecture.

### Phase 5 — UI/UX redesign (not started)

- Production-quality UI, dark mode, refined panels, spacing, typography, visual hierarchy, consistent design system. Redesign admin + student dashboards + course experience. Responsive desktop/tablet/mobile, a11y, loading/empty/error states, polished forms/tables/nav. Avoid generic AI dashboard look. Prefer existing stack (Tailwind, Radix/Base UI, shadcn, Lucide, Hook Form, Zod, Tiptap, dnd-kit) before adding deps.

### Phase 6 — Reliability and testing (not started)

- Automated tests: auth, authz, tokens, server actions, course/module/lesson CRUD, course-import, RLS, critical e2e, build verification, regression. For backend features verify: UI -> server action/API -> validation -> authz -> DB/storage -> response -> UI state. Not complete merely because frontend appears to work.

### Phase 7 — Production hardening (not started)

- Backup/recovery, storage reliability, logging/auditing, monitoring, performance, security review, prod build + deployment verification.

## Security notes

Service-role key server-only; never expose password/token/recovery hashes; server-side authz for admin ops; RLS + constraints; validate server-side; uploaded files untrusted.

## Next session prompt

"Continue LearnForLess development. Read PROJECT_CONTEXT.md and IMPLEMENTATION_PLAN.md and continue from the first unfinished phase. Do not redo completed work."
