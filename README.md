# RoleRoadmap

RoleRoadmap turns a job role (starting with **Frontend Developer**) into a visual interactive
knowledge graph. Every node on the graph is a micro-course with three mandatory phases:
**Theory** (MDX explanation), **Practice** (interactive exercises, in-browser code sandbox), and
**Reinforcement** (FSRS-based spaced-repetition cards). A node only counts as mastered once the
assessment passes *and* the FSRS recall probability is high enough.

## Prerequisites

- Node.js **20+** (this repo is developed on 24.x)
- pnpm **10+** (this repo pins `pnpm@10.7.1` via `packageManager`)
- A Supabase project (cloud or local via `supabase` CLI)
- Stripe test-mode keys, Anthropic API key, PostHog key — see `.env.example`

## Quick start

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env template and fill in values
cp .env.example .env.local

# 3. Run the dev server (turbopack)
pnpm dev
```

Open <http://localhost:3000>.

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | Next.js dev server with Turbopack |
| `pnpm build` | Production build |
| `pnpm start` | Run the production build |
| `pnpm typecheck` | `tsc --noEmit`, strict + `noUncheckedIndexedAccess` |
| `pnpm lint` | ESLint via `next lint` |
| `pnpm format` | Prettier write |
| `pnpm test` | Vitest (jsdom) — unit tests |
| `pnpm test:e2e` | Playwright e2e |
| `pnpm db:generate` | Generate SQL migrations from `src/db/schema.ts` |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:studio` | Drizzle Studio |

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind v4 · shadcn/ui ·
Supabase (Auth + Postgres + RLS) · Drizzle ORM · React Flow · `@next/mdx` · Sandpack ·
ts-fsrs · Anthropic SDK · pgvector · Stripe · PostHog · Vitest · Playwright

For full conventions and non-negotiable rules see [`CLAUDE.md`](./CLAUDE.md).
For the phased build plan see [`ROADMAP.md`](./ROADMAP.md).

## Project layout

```
src/
  app/                    # Next.js App Router routes
  components/             # React components (kebab-case files)
    ui/                   # shadcn/ui primitives
  lib/                    # Pure logic (env, db, fsrs, ai, ...)
  db/                     # Drizzle schema + migrations
  content/roles/
    frontend-developer/   # MDX node files (frontmatter + body)
tests/
  unit/                   # Vitest
  e2e/                    # Playwright
```

## Notes

- pnpm is aliased in some local shells (`_lc pnpm`); inside scripts call `command pnpm`
  to bypass aliases if you hit a `_lc: not found` error.
- A warning about `${NPM_VER_TOKEN}` in `~/.npmrc` is harmless — it refers to a private
  registry that this project does not use.
