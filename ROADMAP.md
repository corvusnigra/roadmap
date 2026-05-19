# План для Claude Code: проект RoleRoadmap (MVP — Frontend Developer трек)

> Документ полностью самодостаточен. Вставляй разделы целиком в окно Claude Code последовательно — каждая фаза — отдельная сессия (или один большой контекст с поэтапным выполнением).

---

## КАК РАБОТАТЬ С ЭТИМ ДОКУМЕНТОМ

1. **Шаг 0 (один раз):** скопируй блок «Системный контекст» в `CLAUDE.md` корня проекта. Claude Code автоматически подтянет его в каждую сессию.
2. **Шаг N (каждая фаза):** в новой сессии Claude Code сначала пишешь: `Прочитай CLAUDE.md и README.md. Затем выполни задачу ниже:` — потом вставляешь промпт фазы целиком.
3. После каждой фазы запускаешь `git commit` и **проверяешь acceptance criteria** руками. Не двигаешь дальше, пока всё зелёное.
4. Используй plan mode (`/plan` или Shift+Tab) для сложных промптов — Claude сначала покажет план, ты подтверждаешь, потом выполнение.

### Best practices промтинга, применённые в этом документе

- Каждый промпт даёт **контекст → задачу → ограничения → критерии готовности → что НЕ делать**.
- Файловые пути, имена пакетов, версии — указаны явно.
- Где уместно — отрицательные примеры («не делай X, потому что Y»).
- Используются XML-подобные теги `<goal>`, `<constraints>`, `<acceptance>` для жёсткой структуры.
- Запросы маленькие: одна фаза = одна логическая единица, а не «построй всё приложение».
- Везде явная инструкция: «сначала составь план в plan-mode и подтверди, потом выполняй».

---

## 0. СИСТЕМНЫЙ КОНТЕКСТ (положи в CLAUDE.md)

```markdown
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
```

---

## ФАЗА 1 — Bootstrap проекта

````
<goal>
Bootstrap a new Next.js 15 monorepo for the RoleRoadmap MVP.
</goal>

<context>
This is a greenfield project. The CLAUDE.md you've already read defines the full
stack and conventions. We're starting empty in the current directory.
</context>

<task>
1. Initialize Next.js 15 with TypeScript strict, App Router, Tailwind v4, ESLint, src/ dir, pnpm.
2. Install: drizzle-orm, drizzle-kit, postgres, @supabase/ssr, @supabase/supabase-js,
   zod, @anthropic-ai/sdk, ts-fsrs, reactflow, @codesandbox/sandpack-react,
   @next/mdx, gray-matter, posthog-js, posthog-node, stripe.
3. Install dev: vitest, @vitest/ui, @testing-library/react, jsdom, playwright,
   @types/node, prettier, prettier-plugin-tailwindcss.
4. Init shadcn/ui with the New York style, neutral base color. Add components:
   button, card, dialog, input, label, toast, progress, badge.
5. Create the folder structure per CLAUDE.md (src/components, src/lib, src/db,
   src/content/roles/frontend-developer, tests/unit, tests/e2e).
6. Create src/lib/env.ts with zod-validated env loader (DATABASE_URL,
   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
   ANTHROPIC_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
   NEXT_PUBLIC_POSTHOG_KEY). Throw helpful errors if missing.
7. Create .env.example mirroring env.ts (no real values).
8. Add scripts to package.json: dev, build, start, typecheck, lint, format,
   test, test:e2e, db:generate, db:migrate, db:studio.
9. Add a minimal app/page.tsx that renders "RoleRoadmap MVP" centered, using
   shadcn Button.
10. Configure vitest.config.ts with jsdom env and the @ alias for src/.
11. Add prettier config + tailwind plugin.
12. Create README.md with: project description (one paragraph from CLAUDE.md
    "What we're building"), prerequisites (Node 20+, pnpm 9+, Supabase project),
    quick-start commands.
</task>

<constraints>
- Use pnpm everywhere, never npm or yarn.
- Tailwind v4 (CSS-first config, no tailwind.config.js unless required by shadcn).
- TypeScript "strict": true plus "noUncheckedIndexedAccess": true.
- App Router only. Do not add the pages/ dir.
- Do NOT install: zustand, redux, mobx, prisma, next-auth, trpc, react-query.
</constraints>

<acceptance>
- `pnpm install && pnpm typecheck && pnpm lint && pnpm build` runs clean.
- `pnpm dev` starts and the page renders.
- `pnpm test` shows "no tests found" without errors.
- `src/lib/env.ts` throws if a required var is missing.
- Repository is committed: one commit "chore: bootstrap Next.js 15 + Supabase stack".
</acceptance>

<plan_first>
Before writing files: output the full file tree you plan to create and the
list of package install commands in order. Wait for my "go" before executing.
</plan_first>
````

---

## ФАЗА 2 — Схема БД и Supabase

````
<goal>
Design and create the Postgres schema in Supabase for users, roles, nodes,
progress, knowledge state (FSRS), events, and subscriptions.
</goal>

<context>
Read CLAUDE.md for the product model. The schema must support:
- Roles → roadmap nodes (DAG with prerequisites).
- Per-user progress per node (locked / in_progress / mastered).
- FSRS state per (user, skill_card): stability, difficulty, due, reps, lapses.
- Event log (xAPI-style: actor, verb, object, result, timestamp).
- Stripe subscription status mapped to user_id.
- AI tutor conversations scoped to (user, node).
</context>

<task>
1. Design schema in src/db/schema.ts using Drizzle ORM. Tables:
   - profiles (one-to-one with auth.users, has display_name, created_at)
   - roles (id, slug, title, summary, status)
   - nodes (id, role_id, slug, title, summary, position_x, position_y,
            estimated_minutes, mandatory boolean)
   - node_prerequisites (node_id, prerequisite_node_id) — composite PK
   - skill_cards (id, node_id, prompt, answer_markdown, kind enum:
                  'flashcard'|'cloze'|'mcq')
   - user_node_progress (user_id, node_id, status enum, mastery_score,
                         started_at, mastered_at) — composite PK
   - user_card_state (user_id, card_id, stability, difficulty, due_at,
                      reps, lapses, last_review_at) — composite PK
   - user_events (id, user_id, verb, object_type, object_id, payload jsonb,
                  created_at) — for analytics
   - tutor_messages (id, user_id, node_id, role enum, content,
                     created_at) — chat history
   - subscriptions (user_id PK, stripe_customer_id, stripe_subscription_id,
                    status, current_period_end)
2. Add Drizzle relations between tables.
3. Generate the SQL migration with drizzle-kit.
4. Hand-write a second migration file with the RLS policies:
   - profiles: select/update own row only.
   - user_node_progress, user_card_state, user_events, tutor_messages,
     subscriptions: full CRUD on rows where user_id = auth.uid().
   - roles, nodes, node_prerequisites, skill_cards: select for authenticated,
     no write from client.
5. Create src/lib/db.ts that exports the drizzle client (server-only) and
   src/lib/supabase/server.ts + src/lib/supabase/client.ts using @supabase/ssr.
6. Add a seed script src/db/seed.ts that inserts the role
   "frontend-developer" and 5 placeholder nodes. Hook it to `pnpm db:seed`.
7. Add tests/unit/db.schema.test.ts that imports the schema and asserts the
   table shapes (presence of required columns and types) without hitting the DB.
</task>

<constraints>
- Use UUIDs everywhere except composite keys.
- All timestamps are timestamptz with default now().
- Enums via pgEnum, not text columns.
- Every user-data table MUST have RLS enabled in the migration.
- The drizzle client must be server-only — add `import 'server-only'` at top of db.ts.
</constraints>

<acceptance>
- `pnpm db:generate` produces a clean migration with no warnings.
- `pnpm db:migrate` applies cleanly to a fresh Supabase project.
- `pnpm db:seed` inserts the role and nodes.
- `pnpm test` passes; schema test runs.
- A note in README.md explains how to set up Supabase locally
  (supabase init + supabase start + the migration steps).
</acceptance>

<what_not_to_do>
- Do not put RLS-bypassing service-role key in any client component.
- Do not create a generic "users" table — Supabase already provides auth.users.
- Do not use Drizzle's `text("...").default("...")` for enums — use pgEnum.
</what_not_to_do>

<plan_first>
Output the Drizzle schema as a single TypeScript code block first.
Wait for "go" before generating migrations.
</plan_first>
````

---

## ФАЗА 3 — Карта роли (React Flow)

````
<goal>
Build the interactive roadmap page at /roles/[slug] that renders a role's
nodes as a React Flow graph.
</goal>

<context>
Reference UX: roadmap.sh. Nodes are clickable rectangles with title and a
status indicator. Edges represent prerequisites. The user can pan and zoom.
Clicking a node navigates to /roles/[slug]/nodes/[nodeSlug].
</context>

<task>
1. Create app/roles/[slug]/page.tsx as a Server Component that loads role +
   nodes + prerequisites + the current user's progress.
2. Render <RoadmapCanvas /> client component (src/components/roadmap/canvas.tsx)
   with React Flow. Layout positions come from nodes.position_x/y for MVP
   (we don't auto-layout yet).
3. Custom node component (src/components/roadmap/node.tsx):
   - shows title, estimated_minutes, status badge (locked/in_progress/mastered).
   - styled with Tailwind: locked = muted, in_progress = primary border,
     mastered = green border + check icon.
   - cursor-pointer; locked nodes show a tooltip "Complete prerequisites first".
4. Click handler:
   - if locked → toast "Locked. Finish: <list of unmet prereq titles>".
   - else → router.push to the node page.
5. Add a mini-progress bar at the top: "12 of 30 mastered" with a shadcn Progress.
6. Loading and error states via Suspense and an error.tsx boundary.
7. Add tests/e2e/roadmap.spec.ts (Playwright):
   - signed-in user sees the canvas with N nodes,
   - clicking a locked node shows the toast,
   - clicking an unlocked node navigates correctly.
</task>

<constraints>
- React Flow imports: `import { ReactFlow, Background, Controls } from 'reactflow'`.
  Don't forget the CSS import `'reactflow/dist/style.css'`.
- Server Component for the page, Client Component for the canvas. Pass
  serialized data via props, not via context.
- No fetch from client. All data comes from the server prop.
- Use the Drizzle client only on the server.
</constraints>

<acceptance>
- Visiting /roles/frontend-developer shows 30 placeholder nodes wired with edges.
- Status colors render correctly based on seeded progress.
- Lock logic matches: a node is unlocked iff all prerequisites are mastered.
- E2E test passes locally.
- Lighthouse Performance ≥ 90 on this page.
</acceptance>

<what_not_to_do>
- Do not implement a graph-layout algorithm yet (no dagre, no elk). Use stored
  positions; we'll add auto-layout in v1.
- Do not load all roles upfront — just the requested slug.
</what_not_to_do>

<plan_first>
Sketch the component tree and the SQL queries you'll run before writing files.
</plan_first>
````

---

## ФАЗА 4 — Страница узла: Theory / Practice / Reinforcement

````
<goal>
Build the per-node page at /roles/[slug]/nodes/[nodeSlug] with three tabbed
phases: Theory, Practice, Reinforcement.
</goal>

<context>
Each node is an MDX file at src/content/roles/frontend-developer/<slug>.mdx
with YAML frontmatter:

---
slug: html-semantics
title: "Semantic HTML"
summary: "Why <article>, <nav>, <header> matter for accessibility and SEO."
estimatedMinutes: 25
prerequisites: []
learningOutcomes:
  - "Identify when to use <section> vs <article>."
  - "Refactor a non-semantic page to semantic HTML."
practice:
  - kind: mcq
    prompt: "Which element best wraps a self-contained blog post?"
    options: ["<div>", "<article>", "<section>", "<aside>"]
    answerIndex: 1
    explanation: "An article is self-contained..."
  - kind: code
    prompt: "Refactor this HTML to use semantic tags."
    starterFile: "starters/01-refactor.html"
    solutionFile: "solutions/01-refactor.html"
flashcards:
  - front: "When do you use <article>?"
    back: "For self-contained, independently distributable content."
---

# Theory body in MDX...

The practice and flashcards arrays drive the Practice and Reinforcement tabs.
</context>

<task>
1. Build a content loader src/lib/content.ts that:
   - reads MDX from src/content/roles/<role>/<node>.mdx,
   - parses frontmatter with gray-matter and validates with zod
     (NodeFrontmatterSchema),
   - compiles MDX to a React component using @next/mdx.
2. The node page Server Component:
   - loads the MDX + frontmatter,
   - loads user_node_progress, user_card_state for cards of this node.
3. Three tabs (shadcn Tabs):
   a) Theory — renders the MDX body. Add a "Mark theory read" button that
      records an event (verb: "read", object: node).
   b) Practice — renders each practice item:
      - mcq: radio group + "Check" button + explanation reveal.
      - code: see Phase 6 (Sandpack). Stub it for now with a placeholder.
      After all practice items are correct once, show "Take mastery quiz"
      button → opens a dialog with 5 randomized MCQs drawn from frontmatter
      (regenerate distractors randomly). Pass criterion = 4/5.
   c) Reinforcement — calls into the FSRS module (Phase 5). Stub the UI:
      "Review N due cards" → list cards with "Show answer" → grade buttons
      Again / Hard / Good / Easy.
4. State machine for node status (server action):
   - On Theory read → status becomes in_progress if locked-unlocked.
   - On mastery quiz pass + at least one Reinforcement round graded → status mastered.
   - mastery_score = quiz_score; persisted in user_node_progress.
5. Every action logs to user_events.
6. Tests:
   - tests/unit/content.test.ts: frontmatter schema validates the seed node,
     rejects malformed examples.
   - tests/e2e/node.spec.ts: a user opens a node, reads theory, passes MCQ,
     passes mastery quiz; the node status flips to mastered.
</task>

<constraints>
- All write paths go through server actions in src/app/.../actions.ts.
- Zod-validate every input.
- The frontmatter schema is the contract — version it and bump if changed.
</constraints>

<acceptance>
- Opening a node renders MDX and all three tabs.
- Completing the flow flips status to "mastered" in DB and unlocks
  downstream nodes.
- E2E test passes.
- The frontmatter validator rejects a sample broken file (covered by unit test).
</acceptance>

<plan_first>
Show the zod schema for the frontmatter first and confirm with me before
generating loader code.
</plan_first>
````

---

## ФАЗА 5 — FSRS-движок повторений

````
<goal>
Implement the FSRS-based spaced repetition core in src/lib/fsrs.ts and wire
it to user_card_state.
</goal>

<context>
We use the open-source ts-fsrs package. The user grades each card with one of
4 ratings: Again (1), Hard (2), Good (3), Easy (4). The algorithm updates
stability/difficulty and produces the next due_at.

For each MDX node, the flashcards array generates skill_cards rows on first
content sync. On first encounter for a user, a user_card_state row is created
in "new" state.

Daily flow:
- A user visiting the dashboard sees a "Review queue" of cards where due_at <= now.
- Cards are drawn across all mastered nodes (and the in_progress one).
- Grading the card updates the FSRS state and writes a user_event.
</context>

<task>
1. src/lib/fsrs.ts:
   - export reviewCard(state, rating, now) → newState with stability,
     difficulty, due_at, reps, lapses.
   - export getDueCards(userId, limit) — server function returning cards
     joined with their node info.
2. Server action gradeCard(cardId, rating):
   - validates rating with zod (1..4),
   - loads current state, calls reviewCard, upserts new state,
     logs event "reviewed".
3. UI at /review (dashboard):
   - shows the current card, "Show answer" reveals, then 4 grade buttons,
     keyboard shortcuts 1..4.
   - after grading, animates to next card.
   - when empty: "No reviews due. Come back tomorrow."
4. Add a "Mini-review" widget at the top of every node page showing 1–3
   due cards from that node specifically (for the Reinforcement tab UX).
5. Tests:
   - tests/unit/fsrs.test.ts: snapshot of reviewCard for fixed inputs,
     property test "Easy never makes due sooner than Good", "Again resets reps".
   - tests/e2e/review.spec.ts: review queue grading flow.
</task>

<constraints>
- Do NOT hand-roll the algorithm. Use ts-fsrs. We only orchestrate.
- Cards are stored in skill_cards; per-user state is in user_card_state.
- Never mutate state in place — always return a new state object.
</constraints>

<acceptance>
- Grading 100 cards with random ratings produces monotonic, sane intervals.
- Review queue page works end-to-end with seed data.
- Unit tests cover Again/Hard/Good/Easy transitions.
</acceptance>

<plan_first>
Outline reviewCard's signature and the upsert path before coding.
</plan_first>
````

---

## ФАЗА 6 — Sandpack-упражнения

````
<goal>
Add interactive code exercises (HTML/CSS/JS) inside the Practice tab using
Sandpack.
</goal>

<context>
For Frontend Developer role, most practice items will be "edit this HTML/CSS
to match the target". A Sandpack template renders the user's code; a test
script runs in the iframe and posts a message back to the parent with PASS/FAIL.
</context>

<task>
1. src/components/practice/code-exercise.tsx (client component):
   - props: starterFiles map, hiddenTests string (JS), targetMarkdown string.
   - renders Sandpack with the starter files visible and the test file hidden.
   - "Run tests" button executes the hidden test script in the iframe.
   - on PASS, calls a prop onPass() that triggers a server action to log progress.
2. Conventions for content authors:
   - test files use a tiny assertion helper exposed via /globals.js inside
     the sandbox (assertEqual, assertHasElement, assertCssMatches).
   - the test script calls `window.__report({ ok: true|false, message })`
     which we listen to via window.postMessage.
3. src/components/practice/code-exercise.test.tsx: render with Vitest + RTL
   and a mock postMessage — assert onPass fires on PASS payload.
4. Add ONE worked example exercise to the seed content
   (node "html-semantics", exercise "refactor-to-semantic").
   Starter file has a non-semantic page; test asserts <article>, <header>,
   <nav> exist.
5. Document the author flow in CONTRIBUTING.md (how to add an exercise:
   starter file paths, test conventions).
</task>

<constraints>
- Sandpack runs in an iframe — we MUST validate postMessage origin and
  schema (zod) before trusting it.
- No code execution server-side. Ever.
- Tests must be small and fast; the user shouldn't wait > 1s for the verdict.
</constraints>

<acceptance>
- The worked example loads in the Practice tab, the user can edit, run tests,
  and pass. On pass, progress is updated and a toast confirms.
- The component test passes.
</acceptance>

<plan_first>
First show the postMessage protocol (zod schema for both directions) and the
file layout for the exercise content.
</plan_first>
````

---

## ФАЗА 7 — AI-тьютор с RAG

````
<goal>
Add an in-page AI tutor (chat) scoped to the current node, with RAG over the
node's MDX content and prerequisites.
</goal>

<context>
The tutor is a Claude-powered assistant that helps the user understand the
current concept. It must NEVER make up content outside the retrieved context.
On hints for practice items, it asks Socratic questions before revealing
solutions.

Retrieval: we index every MDX node + its prerequisites as chunks (~500 tokens)
in pgvector. The tutor retrieves top-K chunks scoped to the current node and
its prerequisites only.
</context>

<task>
1. Indexing pipeline src/lib/rag/index.ts:
   - on `pnpm content:index`, walk src/content/, split each node MDX into chunks,
     embed via Anthropic (or fall back to OpenAI text-embedding-3-small —
     make the embedding provider an interface).
   - store in a Postgres table `content_chunks(id, node_id, chunk_index,
     content, embedding vector(1536))`.
2. Retrieval src/lib/rag/retrieve.ts:
   - retrieve(currentNodeId, query, k=6) returning chunks from the node and
     transitive prerequisites only.
3. Server action sendTutorMessage(nodeId, message):
   - zod-validated input,
   - loads last 10 tutor_messages for this (user, node),
   - retrieves top-K chunks,
   - calls Anthropic with a system prompt enforcing:
     "Use only the provided context. If the answer is not in context, say
     'This is outside the current node's material — ask once you've covered
     <prereq node title>.' Be Socratic for practice hints. Never reveal full
     code solutions unless the user types /solve.",
   - streams the response, persists messages.
4. UI: a side panel toggle on node pages with chat input, message list,
   markdown rendering, code block highlight.
5. Tests:
   - tests/unit/rag/retrieve.test.ts: retrieval respects prerequisite scope.
   - tests/unit/tutor.prompt.test.ts: a sample question outside context yields
     the refusal phrase (mock the LLM with a snapshot-matching stub).
</task>

<constraints>
- The system prompt is a versioned constant in src/lib/ai/prompts.ts.
- Always pass a max_tokens cap (e.g., 1000) to avoid runaway costs.
- Rate-limit per user (20 messages / 10 min for free tier, 200 for paid).
- Store the model id used per message for future auditing.
</constraints>

<acceptance>
- Asking a question on a node returns a streamed answer grounded in MDX.
- Asking off-topic returns the refusal phrase.
- `/solve` reveals the code solution only after a confirmation dialog.
- Rate limiter blocks the 21st request from a free-tier user in 10 minutes.
</acceptance>

<what_not_to_do>
- Don't let the tutor write or modify user code directly.
- Don't include API keys in any client bundle.
- Don't pass the entire MDX corpus — only retrieved chunks.
</what_not_to_do>

<plan_first>
Print the full system prompt and the pgvector schema first, then wait for "go".
</plan_first>
````

---

## ФАЗА 8 — Прогресс, mastery gate и дашборд

````
<goal>
Build the user dashboard that summarizes progress and surfaces the daily session.
</goal>

<task>
1. /dashboard Server Component shows:
   - Hero: "Today's session" — N due cards + next recommended node.
   - Progress ring: % of mastered nodes in the active role.
   - Streak counter (consecutive days with any review or node activity).
   - Last 7 days activity (event count per day) as a sparkline (Recharts).
2. src/lib/progress.ts:
   - computeRoleProgress(userId, roleId) → { mastered, inProgress, locked, total }.
   - getNextRecommendedNode(userId, roleId) → the unlocked node with the
     smallest prerequisites-depth (BFS from already-mastered nodes).
   - getStreak(userId).
3. tests/unit/progress.test.ts for the pure functions (mocked DB).
4. Events for analytics (mirrored to PostHog server-side):
   - session_started, node_opened, theory_read, practice_passed,
     mastery_passed, card_reviewed.
</task>

<acceptance>
- Dashboard accurately reflects seeded progress for a test user.
- Streak increments correctly across day boundaries (use date-fns-tz, the
  user's timezone from profiles).
- PostHog receives events with the user_id distinct id.
</acceptance>

<plan_first>
Show the SQL or Drizzle query for getNextRecommendedNode first.
</plan_first>
````

---

## ФАЗА 9 — Подписка Stripe

````
<goal>
Add a freemium gate: first 5 nodes free, rest behind a $14.99/mo Stripe subscription.
</goal>

<task>
1. Stripe product + price seeded via a one-off script src/scripts/stripe-setup.ts
   (reads STRIPE_SECRET_KEY, creates "RoleRoadmap Pro" $14.99/mo).
2. /pricing page with a single plan card and "Subscribe" button.
3. Server action startCheckout(): creates a Stripe Checkout session for the
   logged-in user, returns the URL, client redirects.
4. /api/stripe/webhook route handler:
   - verifies signature with STRIPE_WEBHOOK_SECRET,
   - handles: checkout.session.completed, customer.subscription.updated,
     customer.subscription.deleted,
   - upserts the subscriptions row.
5. src/lib/access.ts: hasProAccess(userId) → boolean (active or trialing).
6. Gate logic:
   - the roadmap canvas marks nodes beyond index 5 as "locked-pro" if user is
     not pro; clicking shows an upsell modal.
   - hard server-side enforcement in the node page (don't trust the client).
7. /account page exposes a "Manage subscription" button → Stripe Customer Portal.
8. tests/e2e/checkout.spec.ts uses Stripe test mode keys to simulate the flow.
</task>

<constraints>
- All Stripe secrets server-side only.
- The webhook is idempotent (Stripe may retry).
- Never call Stripe from a Client Component.
</constraints>

<acceptance>
- A free user can do nodes 1–5; node 6 prompts the upsell.
- After a successful test-mode checkout, the user gets pro access immediately.
- Cancelling in the Customer Portal triggers the webhook and revokes access
  at period end.
</acceptance>

<plan_first>
Show the webhook event handlers as pseudo-code before writing the file.
</plan_first>
````

---

## ФАЗА 10 — Контент: первые 5 узлов

````
<goal>
Author the first 5 MDX nodes of the Frontend Developer roadmap that any user
can complete on the free tier. Quality must be production-grade.
</goal>

<context>
Target learner: someone who's never built a web page. The 5 nodes are:
1. how-the-web-works — request/response, DNS, HTTP basics.
2. html-document-structure — doctype, head, meta, body.
3. html-semantics — section/article/header/nav/aside.
4. css-box-model — content/padding/border/margin, box-sizing.
5. css-flexbox — main/cross axis, justify-content, align-items, gap.

For each node, write the MDX file in
src/content/roles/frontend-developer/<slug>.mdx with the full frontmatter
(see Phase 4 schema), 600–1200 words of theory, 3–5 practice items (mix of
MCQ + at least one code exercise), and 6–10 flashcards.
</context>

<task>
1. Author all 5 MDX files. Each:
   - Theory uses concrete examples and a small visual (ASCII diagram or
     <Mermaid /> component for the web-works node).
   - At least ONE code exercise per node with starter + solution + hidden tests.
   - Flashcards cover the learning outcomes; each card is a single fact.
   - Mastery quiz set (5+ MCQs) defined in frontmatter (we pick 5 randomly).
2. After each file, run `pnpm content:lint` (see step 3) and fix any errors.
3. Add src/scripts/content-lint.ts:
   - validates each MDX with the frontmatter zod schema,
   - asserts prerequisites all exist,
   - asserts no node is its own ancestor,
   - asserts every flashcard has a non-empty front and back,
   - asserts at least one practice item per node,
   - exits non-zero on failure.
   Wire it as `pnpm content:lint` and into CI.
4. Run `pnpm content:index` (Phase 7) so RAG covers the new content.
5. Update the seed script to load real node metadata from MDX files (instead
   of hard-coded placeholders), keeping positions for the canvas.
</task>

<constraints>
- Don't use the LLM to write the prose. Write it yourself (you, the engineer).
  We will run an LLM editorial pass later, but the first draft is human.
- Keep examples copy-pastable: any code block in the theory must actually run.
- All images: SVG inline or a hosted URL via /public.
</constraints>

<acceptance>
- 5 MDX files exist, lint passes.
- A new user can complete all 5 nodes end-to-end with NO errors.
- Mastery quizzes have at least 8 questions each so the 5-of-N randomization
  is meaningful.
</acceptance>

<plan_first>
Output the 5 frontmatter blocks first (no body). Wait for "go" on each before
writing the body.
</plan_first>
````

---

## АНТИ-ПАТТЕРНЫ ПРИ РАБОТЕ С CLAUDE CODE НА ЭТОМ РЕПО

1. **«Сделай всё MVP сразу одной задачей»** — Claude перегрузится контекстом и качество упадёт. Одна фаза = одна сессия.
2. **«Поменяй фреймворк на X»** — стек зафиксирован в CLAUDE.md. Если хочешь другой — обнови CLAUDE.md явно перед промптом.
3. **«Используй last best practice из интернета»** — без уточнения, что именно и почему. Claude может притащить React Query поверх Server Components и развалить архитектуру. Всегда указывай ограничения списком в `<constraints>`.
4. **«Напиши тесты позже»** — позже не пишутся. Тесты в `<acceptance>` каждой фазы.
5. **Пропускать `<plan_first>`** — для нетривиальных задач это снижает количество переделок в разы. Не убирай этот блок.

---

## ФИНАЛЬНЫЙ ЧЕК-ЛИСТ MVP

- [ ] CLAUDE.md в репо актуален.
- [ ] Все 10 фаз выполнены, каждая в отдельном PR/коммите.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` зелёные.
- [ ] Lighthouse mobile: Performance ≥ 85, Accessibility ≥ 95.
- [ ] Один новый пользователь может зарегистрироваться, пройти все 5 бесплатных узлов, увидеть на 6-м пейволл, оформить подписку в Stripe test mode и сразу его открыть.
- [ ] Дашборд показывает streak, прогресс и due-cards.
- [ ] AI-тьютор отвечает только в рамках контекста узла и его пререкизитов.
- [ ] PostHog получает события session_started, node_opened, mastery_passed.
- [ ] README объясняет, как развернуть локально с нуля за 10 минут.

---

## ПОСЛЕ MVP (на потом, не в первой итерации)

- **v1.1:** AI Engineer как вторая роль (это сейчас самый перспективный трек на рынке).
- **v1.2:** Адаптивный план (структурный vs персональный, как в CFA LES).
- **v1.3:** Knowledge Tracing для умного подбора задач.
- **v1.4:** Геймификация: streaks-лиги, бейджи (без перегруза).
- **v1.5:** B2B Teams (админка, общие треки для команды).
- **v2:** Не-IT вертикали (маркетинг / финансы) на том же движке.

---

## SYSTEM PROMPT КАК ТЫ САДИШЬСЯ ЗА ОЧЕРЕДНУЮ ФАЗУ

> «Ты работаешь в репозитории RoleRoadmap. Прочитай `CLAUDE.md` целиком — там зафиксирован стек, конвенции и анти-паттерны. Также прочитай `README.md` и любые файлы, упомянутые в задаче ниже. Для каждой задачи: (1) сначала составь короткий план в виде маркированного списка и подожди подтверждения «go»; (2) после «go» выполняй маленькими коммитами в формате conventional-commits; (3) после каждого изменения запускай `pnpm typecheck && pnpm lint && pnpm test` и чини всё красное прежде чем продолжить; (4) если требование неоднозначно — задай ОДИН уточняющий вопрос и жди ответа. Не предлагай менять стек или ORM. Не пиши документацию, которую я не просил.»

Этот блок имеет смысл закрепить в Claude Code memory или в начале каждой новой сессии.
