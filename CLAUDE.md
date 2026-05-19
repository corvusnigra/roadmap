# Project: RoleRoadmap

## What we're building
RoleRoadmap is a learning platform that turns a job role (e.g., "Frontend Developer")
into a visual interactive knowledge graph. Each node is a micro-course with three
mandatory phases:
1. Theory (MDX page with explanation, examples, visuals)
2. Practice (interactive exercises, browser sandbox for code roles)
3. Reinforcement (FSRS-based spaced-repetition cards)

A node becomes "mastered" only when the user passes the assessment AND the FSRS
recall probability for its key concepts is ≥ 0.85.

## MVP scope
- ONE role: Frontend Developer (Junior).
- ~30 nodes on the roadmap.
- Free first 5 nodes, paid (Stripe subscription) for the rest.
- AI tutor (Claude API via Anthropic SDK) over RAG of the current node only.

## Tech stack — non-negotiable
- Next.js 15 (App Router), TypeScript strict, React 19
- Tailwind v4 + shadcn/ui
- Supabase (Postgres 15, Auth, Storage, RLS)
- Drizzle ORM (we own the SQL, not Prisma)
- React Flow (roadmap visualization)
- MDX via @next/mdx for content
- Sandpack (@codesandbox/sandpack-react) for code exercises
- ts-fsrs for spaced repetition
- Anthropic SDK for LLM tutor
- pgvector for RAG
- Stripe (subscriptions + Customer Portal)
- Vercel hosting, PostHog analytics
- Vitest + Playwright for testing

## Repo conventions
- `src/app/...` — Next.js App Router routes
- `src/components/...` — React components (kebab-case files)
- `src/lib/...` — pure logic (fsrs, db, ai, etc.)
- `src/content/roles/frontend-developer/` — MDX nodes with YAML frontmatter
- `src/db/schema.ts` — Drizzle schema (single source of truth)
- `tests/unit/...`, `tests/e2e/...`
- All env vars in `.env.local`, typed in `src/lib/env.ts` via zod

## Coding rules
- TypeScript strict, no `any`. If you need an escape hatch, use `unknown` + zod.
- No client-side data fetching in App Router — use Server Components + server actions.
- Every server action validates input with zod.
- Database access only through `src/lib/db.ts`. Never import drizzle directly in routes.
- RLS policies are mandatory on every table that holds user data.
- No localStorage for auth state — Supabase SSR helpers only.
- Tests: every `src/lib/*` module has a `.test.ts` next to it.

## What NEVER to do
- Don't pick a different ORM, auth provider, or DB.
- Don't add Redux, MobX, Zustand. Use Server Components + URL state + React Context only.
- Don't generate course content with the LLM in MVP — content is human-authored MDX.
- Don't add video. Text + interactive is the format.
- Don't build a mobile native app. PWA only for MVP.
- Don't add SCORM/cmi5. Custom event log is enough.

## How to work with me (Claude Code) on this repo
- When given a new task: first output a short plan, wait for "go", then execute.
- Make small commits per logical unit; commit messages in conventional-commits format.
- After every code change, run `pnpm typecheck && pnpm lint && pnpm test` and fix.
- If a requirement is ambiguous, ask ONE clarifying question before writing code.

## Tooling notes
- pnpm is aliased in this user's shell; use `command pnpm` in non-interactive scripts.
- `.npmrc` has a missing `${NPM_VER_TOKEN}` env var — warning only, ignore.
