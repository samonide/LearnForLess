# LearnForLess – Full-Stack Course CMS & Student Portal

## Overview

A production-quality, full-stack Learning Management System (LMS) built with Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Supabase (Auth, PostgreSQL, Storage, RLS). It has two distinct surfaces:

- **Admin Panel** — course creation, module/lesson management, access-token generation, user management
- **Student Portal** — token-based course access, interactive course viewer, progress tracking

---

## User Review Required

> [!IMPORTANT]
> **Supabase Project Required**: You must provide your Supabase Project URL and Anon Key. These go into `.env.local`. The Service Role Key is only used server-side in Server Actions/Route Handlers.
>
> After the code is scaffolded, you'll need to run the SQL migration in your Supabase dashboard (SQL Editor) to create all tables, RLS policies, indexes, and functions.

> [!IMPORTANT]
> **Admin Account Creation**: Since admin accounts need `role = 'admin'` in the `profiles` table, the very first admin must be created manually in Supabase Auth + SQL (or via a seed script). The plan includes a seeding guide.

> [!WARNING]
> **Token Security**: Raw access tokens are generated client-side-visible only once (shown in a modal post-creation) and stored as bcrypt/SHA-256 hashes in the DB. The service role key is only used server-side. Token hashes are never returned to the browser via any API or RLS policy.

---

## Open Questions

> [!IMPORTANT]
> **Rich Text Editor**: The lesson text editor requires a rich text library. I will use **Tiptap** (open-source, headless, React-friendly). Confirm this is acceptable or specify an alternative.

> [!IMPORTANT]
> **PDF Viewer**: For in-browser PDF rendering I will use **react-pdf** (PDF.js wrapper). This adds ~300KB to the bundle but provides proper page navigation and zoom. Confirm this is acceptable.

> [!IMPORTANT]
> **Drag-and-Drop**: For module/lesson reordering I will use **@dnd-kit/core** + **@dnd-kit/sortable**. This is the most production-ready drag-and-drop library for React in 2025. Confirm.

> [!NOTE]
> **Student Auth Strategy**: Since students don't use email/password login, they will use Supabase **anonymous auth** (enabled in project settings). When a token is redeemed server-side, an anonymous session is created or an existing one is found via a session cookie, then courses are granted to that `user_id`. This is the most secure approach without requiring students to register an account.

---

## Proposed Changes

### Phase 1 — Project Scaffolding

#### [NEW] `package.json` / Next.js project
- `npx create-next-app@latest ./ --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`
- Install shadcn/ui, Supabase SSR, Tiptap, react-pdf, @dnd-kit, lucide-react, bcryptjs, etc.

---

### Phase 2 — Database & Supabase Setup

#### [NEW] `supabase/migrations/001_schema.sql`
Complete schema with:
- All 9 tables (profiles, courses, modules, lessons, access_tokens, token_courses, student_access, user_courses, lesson_progress, audit_logs)
- Foreign keys and constraints
- All indexes
- `updated_at` triggers
- All RLS policies (enable RLS + policies per table per role)
- Storage bucket creation + policies
- Helper functions (`get_student_courses`, `redeem_access_token`, etc.)

#### [NEW] `supabase/seed.sql`
Development seed data with Sigma 7.0 course, modules, lessons.

---

### Phase 3 — Core Infrastructure

#### [NEW] `src/lib/supabase/server.ts`
Server-side Supabase client using `@supabase/ssr` — used in Server Components, Server Actions, Route Handlers.

#### [NEW] `src/lib/supabase/client.ts`
Client-side Supabase client — used in Client Components.

#### [NEW] `src/lib/supabase/middleware.ts`
Cookie-based auth refresh middleware.

#### [NEW] `src/middleware.ts`
Next.js middleware — protects `/admin/*` routes (requires admin role), protects `/dashboard` and `/course/*` routes (requires student session), redirects as needed.

#### [NEW] `src/types/database.ts`
Full TypeScript types generated from the DB schema.

#### [NEW] `src/types/index.ts`
Application-level types (CourseWithProgress, LessonWithProgress, etc.)

---

### Phase 4 — Server Actions

#### [NEW] `src/actions/admin/courses.ts`
`createCourse`, `updateCourse`, `deleteCourse`, `publishCourse`, `archiveCourse`

#### [NEW] `src/actions/admin/modules.ts`
`createModule`, `updateModule`, `deleteModule`, `reorderModules`

#### [NEW] `src/actions/admin/lessons.ts`
`createLesson`, `updateLesson`, `deleteLesson`, `reorderLessons`, `uploadLessonFile`

#### [NEW] `src/actions/admin/tokens.ts`
`generateAccessToken`, `disableToken`, `enableToken`, `deleteToken`, `updateTokenCourses`

#### [NEW] `src/actions/admin/users.ts`
`grantCourseAccess`, `revokeCourseAccess`, `getUsers`

#### [NEW] `src/actions/student/access.ts`
`redeemToken` — validates token, creates session, grants courses, increments usage (runs in a DB transaction via RPC)

#### [NEW] `src/actions/student/progress.ts`
`updateLessonProgress`, `getCourseProgress`, `markLessonComplete`

#### [NEW] `src/actions/student/courses.ts`
`getStudentCourses`, `getCourse`, `getLesson`, `getSignedFileUrl`

---

### Phase 5 — Layouts & Route Groups

#### [NEW] `src/app/layout.tsx`
Root layout with font, Toaster.

#### [NEW] `src/app/(public)/layout.tsx`
Minimal public layout (access page, login).

#### [NEW] `src/app/(student)/layout.tsx`
Student layout — top nav with logo, profile, logout. Checks session.

#### [NEW] `src/app/(admin)/layout.tsx`
Admin layout — sidebar + top bar. Checks admin role server-side.

---

### Phase 6 — Public Pages

#### [NEW] `src/app/page.tsx`
Root — redirects to `/access` or `/dashboard` based on session.

#### [NEW] `src/app/access/page.tsx`
Token redemption page — clean single-field form, validates and calls `redeemToken` action.

#### [NEW] `src/app/login/page.tsx`
Generic redirect page (admin login link).

---

### Phase 7 — Student Pages

#### [NEW] `src/app/(student)/dashboard/page.tsx`
Dashboard — fetches `user_courses` + progress, renders course cards. Empty state if no courses.

#### [NEW] `src/app/(student)/course/[courseId]/page.tsx`
Course overview — modules/lessons list, redirects to first unfinished lesson or course viewer.

#### [NEW] `src/app/(student)/course/[courseId]/lesson/[lessonId]/page.tsx`
Main course viewer — sidebar + content area. Authorizes access server-side before rendering.

---

### Phase 8 — Admin Pages

#### [NEW] `src/app/(admin)/admin/login/page.tsx`
Admin email/password login via Supabase Auth.

#### [NEW] `src/app/(admin)/admin/dashboard/page.tsx`
Stats cards + recent activity tables.

#### [NEW] `src/app/(admin)/admin/courses/page.tsx`
Courses table with status badges, actions dropdown.

#### [NEW] `src/app/(admin)/admin/courses/new/page.tsx`
Create course form.

#### [NEW] `src/app/(admin)/admin/courses/[courseId]/page.tsx`
Course detail / overview.

#### [NEW] `src/app/(admin)/admin/courses/[courseId]/edit/page.tsx`
Edit course metadata form.

#### [NEW] `src/app/(admin)/admin/courses/[courseId]/builder/page.tsx`
**Visual course builder** — drag-and-drop modules and lessons, inline editing, lesson editor modal.

#### [NEW] `src/app/(admin)/admin/tokens/page.tsx`
Tokens table — shows hint, assigned courses, status, usage, expiry, actions.

#### [NEW] `src/app/(admin)/admin/tokens/new/page.tsx`
Generate token form + "Token Generated" modal (one-time display).

#### [NEW] `src/app/(admin)/admin/users/page.tsx`
Users table — grant/revoke course access per user.

#### [NEW] `src/app/(admin)/admin/settings/page.tsx`
Platform settings (name, branding, etc.)

---

### Phase 9 — Components

#### Admin Components
- `AdminSidebar` — dark slate sidebar with nav items, active state
- `AdminTopBar` — search, notifications, profile, logout
- `DashboardStats` — stat cards grid
- `CoursesTable` — sortable data table
- `CourseBuilder` — drag-and-drop builder (dnd-kit)
- `LessonEditor` — Tiptap rich text editor + file upload per content type
- `TokensTable` — tokens management table
- `TokenGeneratedModal` — one-time token display with copy button
- `UsersTable` — users management
- `AuditLogTable` — recent activity

#### Student Components
- `StudentTopNav` — logo, profile, logout
- `CourseCard` — thumbnail, title, progress bar, continue button
- `CourseViewer` — two-column layout (sidebar + content)
- `CourseSidebar` — accordion modules, lesson list, progress
- `LessonContent` — dynamic renderer by content type
- `PDFViewer` — react-pdf with controls
- `VideoPlayer` — HTML5 video or embedded
- `ProgressBar` — animated progress indicator
- `MarkCompleteButton` — updates progress

#### Shared Components
- `LoadingSkeleton` variants
- `EmptyState`
- `ErrorState`
- `ConfirmDialog`
- `FileUpload`

---

### Phase 10 — SQL Migration (Complete)

The full SQL file will include:

```sql
-- Tables: profiles, courses, modules, lessons, access_tokens, 
--         token_courses, student_access, user_courses, lesson_progress, audit_logs
-- Triggers: updated_at on all tables
-- Indexes: all specified indexes
-- RLS: enable + policies for each table
-- Functions: redeem_token RPC, get_course_progress, etc.
-- Storage: course-materials bucket
```

---

## Verification Plan

### Automated Build Check
```bash
npm run build
```
TypeScript errors must be 0. ESLint warnings acceptable.

### Manual Verification
1. Run `npm run dev`, navigate to `/access`, enter a valid test token → redirects to `/dashboard` with correct courses.
2. Try an invalid token → shows error.
3. Navigate to `/course/[id]` of an unassigned course → 403/redirect.
4. Admin login → dashboard stats load.
5. Create course → add modules → add lessons → publish → token redemption shows that course.
6. Generate token (shown once) → copy → redeem as student → courses appear.
7. Disable token → re-entry shows "token disabled" error.
8. Mark lesson complete → progress updates in real time.
9. PDF upload → renders in browser for authorized student only.
10. Mobile layout → sidebar collapses to drawer.

---

## File Count Estimate

~80–100 files total across the full production application.

## Development Order

1. ✅ Project scaffold + dependencies
2. ⏳ Supabase schema SQL + seed (needs .env.local setup & manual creation)
3. ✅ Lib infrastructure (clients, middleware, types)
4. ✅ Server actions (all CRUD actions implemented)
5. ✅ Layouts + route groups (admin & student)
6. ✅ Admin pages (dashboard → courses → tokens → users → settings)
7. 🔄 **FRONTEND FOCUS** Student pages (dashboard ✅ → course viewer 🚧 → lesson renderer 🚧)
8. 🚧 Admin Components (course builder 🚧, edit form 🚧, token form 🚧, users list 🚧)
9. ⏳ Polish (loading states, empty states, error states, mobile)

## Current Status – FRONTEND COMPLETE ✅

### ✅ ALL FRONTEND PAGES COMPLETE
- [x] Root page redirect logic
- [x] Public access page (token redemption UI)
- [x] Public login page (navigation)
- [x] Admin login page (email/password auth)
- [x] Student dashboard (course cards, progress bars, responsive)
- [x] Course overview page (module/lesson listing)
- [x] **CourseViewer page** (lesson viewer with sidebar & navigation)
- [x] Admin dashboard (stats cards, activity logs, real-time data)
- [x] Admin courses list page (table with actions)
- [x] Admin create course form (with slug generation)
- [x] Admin **course edit page** (metadata updates)
- [x] Admin **course builder page** (drag-drop interface)
- [x] Admin tokens list page (token management table)
- [x] Admin **create token page** (with one-time modal)
- [x] Admin users directory page (with pagination)
- [x] Admin settings page (config display)
- [x] Student & Admin layouts + navigation (sticky headers, responsive)
- [x] ALL server actions (courses, tokens, users, progress, auth)
- [x] Supabase clients (server/client/middleware)

### ✅ ALL FRONTEND COMPONENTS COMPLETE
- [x] **CourseViewer** — two-column sidebar + content layout with drawer on mobile
- [x] **LessonContent** renderer — dynamic rendering (text, PDF, video, image, file, link)
- [x] **CourseBuilder** — drag-drop module/lesson editor with dialogs
- [x] **EditCourseForm** — metadata editing with auto-slug generation
- [x] **NewTokenForm** — token creation + one-time display modal
- [x] **UsersList** — interactive grant/revoke access UI
- [x] **PDFViewer** — PDF rendering with controls
- [x] All shadcn/ui components (form, dialog, table, badge, etc.)

### 🎯 READY FOR DEMO
**Next steps to go live:**
1. Fill in `.env.local` with Supabase credentials (use `.env.local.example` as template)
2. Run SQL migration from `supabase/migrations/001_schema.sql`
3. Create admin account via Supabase Auth + set `role = 'admin'` in `profiles` table
4. Generate access token via admin panel
5. Test student portal with token redemption

**See [DEMO_SETUP.md](./DEMO_SETUP.md) for complete step-by-step guide**

---
