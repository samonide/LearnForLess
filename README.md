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

`npm run dev` — start dev server
`npm run build` — production build
`npm run lint` — lint
`tsc --noEmit` — type check

## Supabase

Migrations under `supabase/migrations/`. Apply in Supabase Dashboard -> SQL Editor in order:

- `001_schema.sql` — full schema (tables, indexes, RLS, storage bucket, functions `redeem_access_token`, `get_course_progress`, `grant_course_access_admin`)
- `002_token_student_accounts.sql` — `access_tokens.bound_user_id`, `student_access` uniqueness, updated `redeem_access_token` enforcing single-owner binding
- `003_username_auth.sql` — `profiles.username` (partial unique index) for student username/password login
- `seed.sql` — optional sample data

No Supabase CLI link configured. Apply manually via SQL Editor.

## Project docs

- `CLAUDE.md` — project rules
- `AGENTS.md` — agent instructions
- `PROJECT_CONTEXT.md` — verified current state
- `IMPLEMENTATION_PLAN.md` — roadmap

## Security

Service-role key server-only. Token hashes never exposed to client. RLS enforced on all tables. Client checks not trusted for authz.
