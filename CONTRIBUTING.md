# Contributing

## Authoring workflow (TL;DR)

1. **Scaffold** a new MDX skeleton from the template:
   ```bash
   pnpm new:node <slug> --title "Название" --prereq <other-slug> [--minutes 25] [--with-exercise]
   ```
   The scaffolder creates `src/content/roles/<role>/<slug>.mdx` with `status: draft`,
   6 flashcard placeholders, 5 mastery-quiz placeholders, and a theory skeleton.
   With `--with-exercise` it also drops `exercises/<slug>/{starter,solution}.html` and
   `tests.js` stubs.

2. **Fill in TODOs** in the generated MDX. Frontmatter strings AND body text are
   scanned for the literal `TODO` marker.

3. **Add the node to `src/db/seed.ts`** if it's a brand-new slug. The seed is the
   source of truth for `nodes` table rows (id, position on canvas, prerequisites).

4. **Validate**:
   ```bash
   pnpm content:check        # static checks, no DB needed
   pnpm db:seed              # upsert role + nodes + sync flashcards
   pnpm test                 # unit + schema
   pnpm test:e2e             # end-to-end flow
   ```

5. **Flip to published** in the frontmatter (`status: published`) once
   `content:check` is clean. CI / a future pre-publish hook will refuse to ship
   a node that still has `status: draft` or TODO markers.

### Node lifecycle (`status`)

| Status | Meaning | `content:check` floors |
|---|---|---|
| `draft` (default) | Work in progress. Visible on the roadmap canvas but flagged in checks. | schema only |
| `published` | Ready for learners. | ≥ 6 flashcards, ≥ 6 mastery-quiz items, ≥ 1 practice item, no remaining `TODO` markers, all prereq slugs resolve to MDX files |

The lifecycle field lives in frontmatter; the schema defaults to `draft` so
old files without it parse fine on first load.

---

## Frontmatter reference

A node is a single MDX file under `src/content/roles/<role-slug>/<node-slug>.mdx`.
The filename slug **must** match the `slug` field in frontmatter — the loader
asserts this so authors don't accidentally route `html-semantics.mdx` as a
different slug.

The frontmatter contract lives in [`src/lib/content/schema.ts`](./src/lib/content/schema.ts)
and is validated on load. Required fields:

| Field | Notes |
|---|---|
| `schemaVersion` | Currently `1`. Bump when the schema changes incompatibly. |
| `slug` | Kebab-case (`[a-z0-9-]+`); matches the filename and the seeded `nodes.slug`. |
| `title`, `summary` | Plain strings. |
| `status` | `draft` (default) or `published`. See lifecycle table above. |
| `estimatedMinutes` | `1..180`. |
| `prerequisites` | Array of node slugs that must be `mastered` first. Each must resolve to an MDX file under the same role. |
| `learningOutcomes` | At least one. |
| `practice` | Array of `kind: mcq` and/or `kind: code` items. |
| `flashcards` | `front` / `back` pairs. Synced into `skill_cards` on `pnpm content:sync`. |
| `masteryQuiz` | Pool of MCQs (`min(5)` enforced by schema; `content:check` raises that to 6 for `status: published`). |

MCQ items require `explanation` — the learner sees it after they answer.

## Adding a code exercise

A `kind: code` practice item references three files relative to the role
directory:

```yaml
practice:
  - kind: code
    prompt: Refactor this HTML to use semantic landmarks.
    starterFile: exercises/refactor-to-semantic/starter.html
    solutionFile: exercises/refactor-to-semantic/solution.html
    testsFile: exercises/refactor-to-semantic/tests.js
    language: html
```

### File layout (per exercise)

```
src/content/roles/<role>/
  exercises/<exercise-slug>/
    starter.html        # what the user sees and edits
    solution.html       # mirror with the fix applied; used by /solve in a later phase
    tests.js            # hidden, posts pass/fail via __report()
```

The starter HTML **must** end with these two script tags so the test helpers
and assertions load inside the Sandpack iframe:

```html
<script src="globals.js"></script>
<script src="tests.js"></script>
```

(The runtime injects `globals.js` automatically — you don't ship it yourself.)

### Test helpers available to `tests.js`

These are defined in [`src/lib/sandpack/globals.ts`](./src/lib/sandpack/globals.ts)
and are available on `window` inside the iframe:

| Helper | Behaviour |
|---|---|
| `__report({ ok, message })` | Reports the verdict to the parent component. **Required.** |
| `assertHasElement(selector)` | Throws if `document.querySelector(selector)` is null. |
| `assertEqual(actual, expected, hint?)` | Throws if `actual !== expected`. |
| `assertCssMatches(selector, prop, expected)` | Throws if `getComputedStyle(el)[prop] !== expected`. |

A minimal `tests.js`:

```js
(function () {
  function run() {
    try {
      assertHasElement("article");
      assertHasElement("nav");
      __report({ ok: true, message: "Landmarks present." });
    } catch (err) {
      __report({ ok: false, message: err.message });
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
```

### Author checklist (per code exercise)

- [ ] `pnpm content:check` — frontmatter, prereq slugs, exercise files all resolve.
- [ ] `pnpm db:seed` — ensures the node exists in the DB and pushes flashcards.
- [ ] `pnpm test` — schema unit tests + the rest of the unit suite.
- [ ] `pnpm test:e2e` — exercise flow runs end-to-end.
- [ ] Manually click "Run tests" against the starter and the solution to verify
      the assertions fire in the expected direction.
- [ ] Flip `status: draft → published` in frontmatter once the checklist is green.

## State machine cheat sheet

- `theory_read` event → node flips `locked → in_progress`.
- `mastery_passed` event + at least one `card_reviewed` event → node flips
  `in_progress → mastered`. Downstream nodes unlock automatically.
- `practice_correct` events are recorded but don't gate anything server-side
  yet — gating lives in client state.

## Tech debt to be aware of

- The `roles.nodes` table stores its own `node_prerequisites` separately from
  MDX `prerequisites`. They must match by hand. Phase 10 will reconcile.
- Sandpack adds ~230 kB to the node-page bundle. Phase 8 will lazy-load it
  per code item instead of eager-loading on tab mount.
