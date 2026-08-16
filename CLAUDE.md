# LearnForLess

## Project

LearnForLess is a full-stack course CMS and student learning platform.

The repository is an existing application. Understand the current implementation before changing it.

## Stack

- Next.js 16.3
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase
- Radix UI / shadcn
- Base UI
- React Hook Form
- Zod
- Tiptap
- dnd-kit
- Lucide

Prefer the existing stack and dependencies. Do not add a dependency unless it is genuinely necessary.

## Core Rules

1. Do not rewrite working systems without understanding them first.
2. Do not modify unrelated files or features.
3. Prefer small, maintainable changes.
4. Preserve existing architecture unless there is a clear reason to change it.
5. Never expose secrets, service-role credentials, password hashes, or token hashes.
6. Client-side checks are never sufficient for authorization; enforce authorization server-side.
7. Validate important backend input server-side.
8. Never store passwords in plaintext.
9. Treat uploaded files and databases as untrusted input.
10. Do not manually edit `node_modules`.
11. Do not downgrade Next.js to solve compatibility problems.
12. Before adding a library, check whether the existing dependencies already solve the problem.

## Codebase Understanding

Use CodeGraph when it can reduce unnecessary repository exploration, especially for:

- how something works
- where something is implemented
- tracing dependencies
- understanding relationships
- assessing change impact

Do not perform broad repository-wide searches when the task can be solved by inspecting a smaller relevant area.

## Documentation

Keep these files accurate and concise:

- `PROJECT_CONTEXT.md` — current project context
- `IMPLEMENTATION_PLAN.md` — current progress and future roadmap

Do not duplicate their contents into `CLAUDE.md`.

Do not claim a feature is complete unless it has been verified.

## Development Workflow

For non-trivial work:

1. Understand the relevant existing code.
2. Check the database/schema when backend behavior is involved.
3. Make the smallest appropriate change.
4. Verify the affected behavior.
5. Run relevant typecheck/lint/build/tests when practical.
6. Update project documentation only when the project state actually changed.

For complex feature work, use the appropriate Superpowers workflow.

For frontend work, use the frontend-design skill when appropriate.

For external libraries or APIs where version-specific behavior matters, use Context7 when appropriate.

## Token / Context Efficiency

Keep responses concise and action-oriented.

Do not repeatedly explain the entire project.

Do not reread unrelated files.

Do not load large documents unless they are relevant to the current task.

Prefer targeted investigation over repository-wide exploration.

When a task is complete, report the result briefly and stop.

## Session Continuation

At the beginning of a new development session:

1. Read `PROJECT_CONTEXT.md` if project context is needed.
2. Read `IMPLEMENTATION_PLAN.md` to determine the current phase.
3. Continue from the first unfinished relevant task.
4. Do not redo completed work unless verification shows it is necessary.

When explicitly told to work on a specific task, prioritize that task over the general roadmap.
