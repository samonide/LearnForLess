# LearnForLess

Course CMS and student learning platform. Admin creates courses, modules, lessons and issues access tokens. Students redeem tokens to access published courses.

## Stack

Next.js 16.3, React 19, TypeScript, Tailwind 4, Supabase, Radix UI / shadcn / Base UI, React Hook Form, Zod, Tiptap, dnd-kit, Lucide.

## Getting started

```bash
npm install
cp .env.local.example .env.local   # fill Supabase keys
npm run dev                        # http://localhost:3000
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | Lint |
| `tsc --noEmit` | Type check |
| `npm test` | Run all unit/integration tests (Vitest) |
| `npm run test:integration` | Run integration tests only |
| `npm run test:e2e` | Run Playwright E2E browser tests |

## Tests

- **Unit tests** (11): `tests/unit/` — importer parser and B2 presigning.
- **Integration tests** (85): `tests/integration/` — auth-flow, authz-security, CMS CRUD, token generation, importer (import/re-import/source resolution). Requires live Supabase instance with `.env.local` configured. Total Vitest suite: 96 tests.
- **E2E tests** (28): `tests/e2e/` — auth-flow, token-redemption, student-courses, admin, phase-a-verify, lesson-editor-visual, view-access-visual. Requires `npm run dev` running (auto-started by Playwright webServer). See `tests/README.md` for setup.

## Supabase

Migrations under `supabase/migrations/`. Apply in Supabase Dashboard → SQL Editor in order:

1. `001_schema.sql` — full schema (tables, indexes, RLS, storage bucket, functions)
2. `002_token_student_accounts.sql` — `access_tokens.bound_user_id`, single-owner binding
3. `003_username_auth.sql` — `profiles.username` partial unique index for student login
4. `004_recovery_tokens.sql` — password recovery tokens (hashed, single-use, 24h expiry)
5. `005_security_fixes.sql` — RPC RLS guards, simplified admin grant, lesson_progress UPDATE policy
6. `006_site_settings.sql` — `site_settings` singleton (branding: site name, slogan, logo, footer, support email)
7. `007_course_imports.sql` — importer source columns on courses/modules/lessons + `course_imports` bookkeeping table

Optional: `seed.sql` — sample data.

No Supabase CLI link configured. Apply manually via SQL Editor.

## Project docs

- `CLAUDE.md` — project rules
- `AGENTS.md` — agent instructions
- `PROJECT_CONTEXT.md` — verified current state
- `IMPLEMENTATION_PLAN.md` — roadmap
- `DEPLOYMENT.md` — production deployment guide (TODO)

## Security

Service-role key server-only. Token hashes never exposed to client. RLS enforced on all tables. Client checks not trusted for authz. All 5 migrations include security-critical policies and functions.