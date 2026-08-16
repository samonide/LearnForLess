# LearnForLess Agent Instructions

## 1. Existing Codebase

This is an existing production-oriented application.

Before modifying code:

- inspect the relevant implementation
- understand existing patterns
- check related types and server/client boundaries
- check database schema/migrations for database-related work

Do not rewrite the project from scratch.

Do not perform broad refactors unless explicitly requested.

## 2. Next.js

The project uses Next.js 16.3.

Do not assume behavior from older Next.js versions.

For Next.js-specific changes:

- follow the installed version
- inspect existing project patterns first
- use current Next.js documentation when necessary
- use Context7 when version-specific external documentation is useful

Never downgrade Next.js merely to make old code work.

## 3. React / Server Boundaries

Respect Next.js server/client boundaries.

Before adding `"use client"`:

- determine whether the component actually requires client behavior
- keep server-side logic on the server

Never expose server-only credentials or privileged operations to client components.

## 4. Supabase / Database

For database-related work:

1. Inspect existing migrations.
2. Inspect the relevant schema.
3. Inspect generated types.
4. Inspect existing queries/server actions.
5. Inspect RLS policies when authorization is involved.
6. Identify schema/code mismatches before changing anything.

Do not blindly add columns or tables to make an error disappear.

Do not create duplicate database structures when an existing structure should be corrected.

Prefer migrations for schema changes.

Keep application code, migrations, and generated types consistent.

## 5. Authentication / Authorization

Authentication and authorization are security-sensitive.

Never rely solely on:

- hidden UI
- client-side role checks
- route visibility
- client-provided user IDs
- client-provided admin flags

Important authorization decisions must be enforced server-side.

Never expose:

- Supabase service-role keys
- password hashes
- access-token hashes
- recovery-token hashes
- private storage credentials

Passwords must never be stored in plaintext.

## 6. Storage / Files

Treat uploaded files and uploaded databases as untrusted input.

Validate inputs before processing them.

Do not execute arbitrary code from uploaded files.

Do not expose private storage credentials.

Use the appropriate secure mechanism for protected resources, such as signed URLs or server-side access.

Do not hash values that the application later needs to recover. Hashing is one-way.

## 7. API / Server Actions

For backend operations:

- validate input
- authenticate the user when required
- authorize the operation
- perform the database/storage operation
- return appropriate errors
- verify the resulting behavior

Do not consider a feature complete because the UI renders successfully.

For important mutations, verify that the actual database state changed correctly.

## 8. UI

Use the existing UI ecosystem whenever possible:

- Tailwind
- Radix UI
- shadcn
- Base UI
- Lucide

Do not introduce another UI framework without a strong reason.

Maintain consistent:

- spacing
- typography
- colors
- component behavior
- responsive behavior
- loading states
- empty states
- error states
- accessibility

Avoid generic AI-generated dashboard patterns.

For major frontend work, use the frontend-design skill.

## 9. Dependencies

Before installing a package:

1. Check whether an existing dependency already provides the functionality.
2. Check whether the functionality can reasonably be implemented with the current stack.
3. Only add the dependency if it provides clear value.

Never modify `node_modules` manually.

## 10. CodeGraph

Use CodeGraph for targeted repository intelligence.

Prefer it for:

- tracing code
- locating implementations
- understanding dependencies
- understanding symbol relationships
- assessing change impact

Do not use CodeGraph merely because it is available when a small direct inspection is sufficient.

## 11. Superpowers

For complex feature work, use the appropriate Superpowers workflow.

Typical flow:

brainstorm
→ plan
→ implement
→ verify
→ review

Do not invoke unnecessary workflows for trivial fixes.

## 12. Verification

After meaningful changes, run the smallest relevant verification set.

Possible checks:

- TypeScript/typecheck
- ESLint
- build
- unit tests
- integration tests
- database verification
- authorization tests
- affected UI flow

Do not run expensive unrelated checks merely for the sake of running them.

Never claim verification that was not actually performed.

## 13. Documentation

Keep:

`PROJECT_CONTEXT.md`

focused on current project context.

Keep:

`IMPLEMENTATION_PLAN.md`

focused on project progress and future work.

Do not turn these files into massive specifications.

Update them when significant project state changes.

## 14. Scope Control

When given a specific task:

- work only on that task
- avoid unrelated improvements
- avoid opportunistic refactoring
- avoid changing unrelated UI
- avoid installing unrelated packages

If you discover an unrelated issue:

- do not automatically fix it
- mention it briefly if it is important

## 15. Token Efficiency

Context is valuable.

Therefore:

- do not reread large files unnecessarily
- do not repeatedly rediscover repository structure
- do not repeat information already established in the current session
- do not dump large command outputs when a targeted command is sufficient
- do not load unrelated documentation
- keep responses concise
- prefer targeted searches and inspections
- use CodeGraph where it meaningfully reduces discovery work

Do not sacrifice correctness merely to save tokens.

## 16. Completion Rule

A task is complete only when:

1. The requested implementation exists.
2. The affected behavior has been verified.
3. No obvious regression was introduced.
4. Relevant documentation is updated if necessary.

Then stop.

Do not automatically begin the next roadmap phase.
