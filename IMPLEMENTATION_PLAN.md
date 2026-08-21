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
- 65 integration tests (7 authz-security + 19 auth-flow + 32 CMS CRUD + 6 token-generation + 1 admin grant) — all pass.
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

### Phase 5b — Access Token Architecture Fix (2026-08-20)

Fix regression where token generation created phantom auth users and manual course grant failed with "Not authenticated".

**Completed items:**
- `generateAccessToken()`: removed phantom auth-user creation. Token generation now only creates `access_tokens + token_courses + audit_logs`. No `auth.users`, `profiles`, `user_courses`, or `student_access` writes. `bound_user_id` stays NULL until student redemption.
- Removed `buildStudentTokenLoginEmail()` from `src/lib/utils.ts` (unused after fix).
- `grantCourseAccess()`: uses authenticated client from `getAdminUser()` instead of service-role `createAdminClient()`. Fixes `auth.uid()` NULL → "Not authenticated" in `grant_course_access_admin` RPC.
- Redemption architecture preserved: `redeemTokenAuthenticated()` + `redeem_access_token` RPC operates on existing authenticated student account.

**Tests (regression coverage):**
- `tests/integration/token-generation.test.ts`: 6 tests (generation creates no auth user, correct `created_by`, correct `token_courses`, `bound_user_id` NULL before redemption, static source-code guards).
- `tests/integration/auth-flow.test.ts`: +1 test ("redemption grants an existing student account" — creates independent student, redeems token, verifies binding + course grant).
- `tests/integration/authz-security.test.ts`: +1 test ("admin grant actually grants the student access" — verifies `user_courses` row after admin grant).
- Total: 65 integration tests, all pass against live hosted Supabase.

**Verification:** `tsc --noEmit` passes. `npm run build` passes adjective `npm test` (65 tests) all pass.

**Status:** COMPLETE (2026-08-20).

### Phase 6a — Student UI Fixes (2026-08-19)

Purpose: Address 7 student-facing UI/product issues.

**Completed items:**
- **Navbar**: Removed standalone Dashboard nav item. Made full-width with proper alignment. Reduced height (h-14 vs h-16). Smoother backdrop blur. Kept user icon + display name + compact logout button.
- **Underlines**: `.prose-lesson a` changed from `underline hover:no-underline` to `no-underline hover:underline`. Added `no-underline` to lesson sidebar links and course overview lesson list links.
- **Lesson page layout**: Moved lesson title/header into upper content area. Video/media container now full-width (max-w-5xl content area). Lesson action area (Mark as Complete, navigation) stays in lower section. Improved spacing hierarchy — lesson material clearly primary focus.
- **Video.js**: Replaced native `<video>` with Video.js + @videojs/http-streaming. Custom dark theme matching LearnForLess design system (custom big play button, progress bar, control bar styling). Preserved HLS/M3U8 and MP4 support. Preserved progress tracking (throttled timeupdate, seek to last_position).
- **PDF viewer**: Replaced iframe PDF with react-pdf (Document/Page). Added page navigation (prev/next, page counter), zoom (0.5x-2.5x), fullscreen toggle, loading/error states. Dark-theme integrated.
- **Downloads**: Renamed "Download Attachment" → "Lesson Material", "Download File" now before icon. No raw storage URLs exposed in UI text.
- **Dashboard course nav**: Split single card Link into title/thumbnail → `/course/[courseId]` and Continue button → lesson URL. CourseCard and FeaturedCard now take separate `courseHref` and `continueHref` props. FeaturedCard: title/thumbnail/description inside Link, Continue button + meta/progress outside.
**Video.js + PDF runtime fixes (2026-08-20):**
- Video.js: removed `data-setup="{}"` (redundant — initialized programmatically; could conflict). Switched `fluid: true` to `fluid: false` + `fill: true` and moved `aspect-video` onto the wrapper so the player fills its container with fixed 16:9 box instead of computing size at init. Overlay loading spinner now `absolute inset-0` over the video rather than a static sibling that collapsed layout on first navigation. Added `key={lessonId}` on `<VideoPlayer>` in course-viewer so lesson navigation remounts and freshly initializes the player (fixes invisible player on first nav + broken controls after refresh).
- Verified: first-navigation render, controls present after refresh, player fills lesson content width.
- `tsc --noEmit` passes. `npm test` (57 integration tests) passes. `npm run build` passes.

**Adds dependency:** video.js, @videojs/http-streaming (already had hls.js, react-pdf, pdfjs-dist).

### UI/UX Workstream

#### UI-A — Navigation + Edge States (2026-08-20)

**P1.1 — Admin sidebar active nav state:**
- Extracted nav links from `(admin)/layout.tsx` into new client component `AdminSidebarNav` (`src/components/admin-sidebar-nav.tsx`).
- Uses `usePathname()` to detect current route: exact match for Dashboard and Settings, prefix match for child routes (Courses, Access Tokens, User Directory).
- Active link gets `bg-sidebar-accent text-sidebar-accent-foreground` + `aria-current="page"`.
- Inactive links keep existing `text-sidebar-foreground/80` + hover state.
- Unused Lucide icon imports removed from layout.

**P6.3 — Loading/error/not-found boundaries:**
- Created 13 boundary files across all route groups:
  - Root: `loading.tsx`, `error.tsx`, `not-found.tsx`
  - `(admin)`: `loading.tsx`, `error.tsx`, `not-found.tsx`
  - `(student)`: `loading.tsx`, `error.tsx`, `not-found.tsx`
  - `(public)`: `loading.tsx`, `error.tsx`, `not-found.tsx`
  - `admin/login/`: `loading.tsx`, `error.tsx`
- Loading: centered spinner (`Loader2`) + "Loading..." text.
- Error: "Something went wrong" + "Try Again" button (calls `reset()`).
- Not-found: "Page not found" + redirect link per route group.
- All use existing design tokens (no new CSS).

**Verification:**
- `tsc --noEmit` passes.
- `npm run build` passes (Compiled successfully, 19 routes).
- Browser E2E verification (2026-08-20): `tests/e2e/phase-a-verify.spec.ts` — 11 tests, all pass.
  - Admin sidebar active state (Dashboard, Courses, Courses/New, Courses/[id]/builder, Tokens, Users, Settings) + exactly-one-active check.
  - Root and admin not-found boundaries render correct "Page not found" + redirect link.
  - Loading/error/not-found boundary file structure verified at source (13 files across root, (admin), (student), (public), admin/login).

**Status:** COMPLETE (2026-08-20).

#### UI-B — Responsive + Accessibility (2026-08-20)

Purpose: Address mobile/responsive issues and accessibility gaps from the UI/UX audit (Phase B).

**Completed items:**
- **P2.1 — Admin sidebar collapsible on mobile**: New `AdminMobileSidebar` client component wraps `AdminSidebarNav` in a Base UI Sheet drawer. Desktop sidebar (`hidden md:flex md:w-64`) hidden on mobile. Admin top bar now includes hamburger menu button (`md:hidden`). Sheet `w-72`, `side="left"`, `bg-sidebar` theme, includes brand header, nav, and footer user info. Trigger uses Base UI `render` prop pattern.
- **P2.2 — Table overflow-x-auto on mobile**: Wrapped all 5 shadcn Table instances with `overflow-x-auto` for horizontal scroll on small screens: tokens list, courses list, admin users list, dashboard course tables (2).
- **P2.3 — Dashboard cards at 320px**: FeaturedCard metadata row (modules/lessons/completed + Continue button) changed from `flex items-center justify-between` to `flex flex-col sm:flex-row items-start sm:items-center justify-between` so metadata stacks vertically on the smallest viewports instead of overflowing.
- **P2.4 — WCAG touch targets (min 44px)**: Added `min-h-[44px]` to all sidebar nav links in `AdminSidebarNav`.
- **P2.5 — Auth card padding at smallest breakpoints**: Changed `p-8 md:p-10` to `p-6 sm:p-8 md:p-10` on login, register, recover, and admin login pages.
- **P2.6 — Student lesson viewer Sheet overflow**: SheetContent width changed from `w-80` (320px, overflows 320px viewport) to `w-[calc(100vw-1.5rem)] sm:w-80` — at very small viewports the sheet fills the available width, otherwise returns to 320px.
- **P2.7 — Viewport meta tag**: Added `export const viewport: Viewport = { width: "device-width", initialScale: 1 }` to root layout.
- **P6.2 — Keyboard focus indicators**: Added `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar` to all sidebar nav links.

**Files created:**
- `src/components/admin-mobile-sidebar.tsx` — mobile Sheet drawer component

**Files modified:**
- `src/app/layout.tsx` — viewport meta export
- `src/app/(admin)/layout.tsx` — mobile sidebar integration, sidebar hidden on mobile
- `src/components/admin-sidebar-nav.tsx` — 44px touch targets, focus rings, onNavClick prop
- `src/components/users-list.tsx` — overflow-x-auto wrapper
- `src/app/(public)/login/page.tsx` — auth card padding
- `src/app/(public)/register/page.tsx` — auth card padding
- `src/app/(public)/recover/page.tsx` — auth card padding
- `src/app/admin/login/page.tsx` — auth card padding
- `src/app/(student)/dashboard/page.tsx` — FeaturedCard responsive layout at 320px
- `src/components/course-viewer.tsx` — SheetContent responsive width

**Verification:** `tsc --noEmit` passes. `npm run build` passes.

**Status:** COMPLETE (2026-08-20).

#### UI-C — Design Consistency (2026-08-20)

Purpose: Apply ring-to-border replacements, remove decorative labels, fix section label typography per DESIGN.md.

**Completed items:**
- **Ring→border replacements (DESIGN.md 3.4):** All 16 files updated — shadcn Card, PDF viewer, student nav avatar, error state icon containers, alert dialog, dialog, dropdown menu, popover, select components. Cards use `border border-border`, not rings.
- **Decorative "CMS" subtitle removed (DESIGN.md 4.7):** Removed from admin sidebar brand in both desktop layout and mobile sidebar drawer. Brand is now icon + "LearnForLess" only.
- **Decorative "Admin" label removed (DESIGN.md 7):** Removed from admin top bar.
- **Section labels fixed (DESIGN.md 5.4):** Dashboard section labels ("In progress", "Not started", "Completed", "Redeem access token", "Redeem another token") changed from `text-xs font-semibold text-muted-foreground uppercase tracking-widest` to `text-sm font-semibold text-foreground`.
- **Admin stat card labels:** Changed from `text-xs font-medium text-muted-foreground uppercase tracking-wide` to `text-xs font-medium text-foreground`.
- **Admin settings section headings:** Changed from `text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-muted-foreground` to `text-sm font-semibold flex items-center gap-2 text-foreground`.
- **Course viewer breadcrumb metadata:** Removed `uppercase tracking-wide` from module/lesson breadcrumb indicator.
- **Preserved** existing minimal charcoal direction — no new visual style.

**Files modified (16):**
- `src/components/ui/card.tsx` — ring→border on shadcn Card
- `src/components/pdf-viewer.tsx` — ring→border on container
- `src/app/(student)/layout.tsx` — ring→border on avatar
- `src/app/(student)/course/[courseId]/page.tsx` — ring→border on error icon
- `src/app/(student)/course/[courseId]/lesson/[lessonId]/page.tsx` — ring→border on error icon
- `src/components/ui/alert-dialog.tsx` — ring→border on dialog
- `src/components/ui/dialog.tsx` — ring→border on dialog
- `src/components/ui/dropdown-menu.tsx` — ring→border on menu
- `src/components/ui/popover.tsx` — ring→border on popover
- `src/components/ui/select.tsx` — ring→border on select
- `src/app/(admin)/layout.tsx` — removed "CMS" subtitle and "Admin" label
- `src/components/admin-mobile-sidebar.tsx` — removed "CMS" subtitle
- `src/app/(student)/dashboard/page.tsx` — section label typography
- `src/app/(admin)/admin/dashboard/page.tsx` — stat card label typography
- `src/app/(admin)/admin/settings/page.tsx` — section heading typography
- `src/components/course-viewer.tsx` — breadcrumb metadata typography

**Verification:** `tsc --noEmit` passes. `npm run build` passes (Compiled successfully, all pages generated).

**Status:** COMPLETE (2026-08-20).

#### UI-D — Media + Performance UX (2026-08-20)

Purpose: Improve video player experience, PDF viewer usability, media loading/error states, and content hierarchy.

**Completed items:**

**PDF viewer:**
- Replaced `shadow-elevated` with `border border-border` on Page component per DESIGN.md 3.4 (no shadows by default)
- Responsive height: `min-h-[400px]` base + `h-[65vh]` mobile + `md:h-[75vh]` desktop instead of fixed `h-[75vh]`
- Added keyboard navigation (ArrowLeft/ArrowRight/PageUp/PageDown for prev/next, Escape for fullscreen exit)
- Added page number input field with form submit (direct entry, non-digit filter, blur on submit)
- Added retry button on error state (`RotateCw` + "Retry")
- Added loading context text ("Loading PDF...") to spinner
- Added `Minimize` icon for fullscreen exit button (toggles with Maximize)
- Input-controlled page navigation with `select-on-focus` and `replaceAll` for non-digit input

**Video player:**
- Added retry button on error state with `RotateCw` + "Retry" — uses `retryKey` state to reinitialize player
- Improved error UI: `destructive/10` icon container, "Video unavailable" heading, error message, lesson title
- Added loading context text ("Loading video...") to spinner overlay
- Added fade transition (`transition-opacity duration-300`) between loading and ready states
- Video element uses `opacity-0` → `opacity-100` transition when ready

**Course viewer (media states + content hierarchy):**
- Consistent empty-state design across all 6 content types (video, pdf, image, link, file, unsupported): `p-10`, `flex flex-col items-center gap-4`, `w-12 h-12 rounded-full bg-muted` icon container, `text-sm text-muted-foreground` message
- Added `loading="lazy"` to image element for deferred loading performance
- All empty states use consistent spacing and visual hierarchy

**Verification:** `tsc --noEmit` passes. `npm run build` passes (Compiled successfully, all pages generated).

**Status:** COMPLETE (2026-08-20).

### UI-E — Design Polish + Micro-interactions (2026-08-20)

Purpose: Final design polish — micro-interactions, loading skeletons, toast styling, empty-state illustration.

**Completed items:**
- **Progress bar animation**: Added `transition-all duration-500` to progress bars in Base UI ProgressIndicator, dashboard CourseCard, FeaturedCard, and inline progress bars per DESIGN.md 500ms requirement.
- **Loading skeleton component**: Created `src/components/ui/skeleton.tsx` using `animate-pulse` + `bg-muted/70`. Applied to:
  - Video player — skeleton fills loading state instead of spinner overlay
  - PDF viewer — skeleton placeholders for document and page loading states
- **Toast styling**: Replaced Sonner `richColors` with custom CSS variables matching design system oklch palette. Custom `toastOptions` in layout.tsx. Hidden icons for cleaner appearance. All themed via `[data-sonner-toaster]` CSS variables.
- **Dashboard empty-state illustration**: Created `src/components/empty-state-illustration.tsx` — minimal SVG geometric shapes (open book, floating dots) using design-system CSS custom properties. Adapts to light/dark mode. Placed beside empty-state copy on dashboard.

**Intentionally skipped (already adequate per DESIGN.md motion philosophy):**
- Button hover/focus/active transitions — `transition-all` already present
- Link hover treatment — `transition-colors` and `hover:underline` already present
- Card hover feedback — `hover:border-muted-foreground/30` already present
- Page transition fade — DESIGN.md explicitly says no page transitions
- Sidebar collapse animation — Sheet already has `transition duration-200`
- Lesson/module reveal — Accordion already has `animate-accordion-down/up`
- Scrollbar styling — already present in globals.css
- focus-visible consistency — already present on buttons, nav links, accordion
- Loading skeletons beyond video/pdf — other content types (text, image, link, file) load near-instantly, skeleton would add noise

**Unused import cleanup:**
- Removed unused `Loader2` import from `pdf-viewer.tsx`

**Verification:** `tsc --noEmit` passes. `npm run build` passes (Compiled successfully, all pages generated).

**Status:** COMPLETE (2026-08-20).

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