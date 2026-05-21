/**
 * Scaffolder for a new MDX node. Creates:
 *  - src/content/roles/<role>/<slug>.mdx            — frontmatter + theory skeleton
 *  - src/content/roles/<role>/exercises/<slug>/     — only when --with-exercise
 *
 * Refuses to overwrite existing files. Status is always `draft` — flip it to
 * `published` after `pnpm content:check` is clean.
 *
 * Usage:
 *   pnpm new:node <slug> --title "..." [--role frontend-developer] \
 *                        [--prereq slug-a --prereq slug-b]         \
 *                        [--minutes 25] [--with-exercise]
 *
 * Examples:
 *   pnpm new:node css-flexbox --title "CSS Flexbox" --prereq css-box-model
 *   pnpm new:node js-array-methods --title "JS Array Methods" --minutes 30 --with-exercise
 */

import { mkdir, writeFile, access, constants } from "node:fs/promises";
import path from "node:path";

interface Args {
  slug: string;
  title: string;
  role: string;
  prereqs: string[];
  minutes: number;
  withExercise: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> & { prereqs: string[] } = {
    role: "frontend-developer",
    prereqs: [],
    minutes: 25,
    withExercise: false,
  };

  // First positional is the slug.
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--title") args.title = argv[++i];
    else if (a === "--role") args.role = argv[++i];
    else if (a === "--prereq") args.prereqs.push(argv[++i]!);
    else if (a === "--minutes") args.minutes = Number(argv[++i]);
    else if (a === "--with-exercise") args.withExercise = true;
    else if (a.startsWith("--")) {
      throw new Error(`Unknown flag: ${a}`);
    } else positional.push(a);
  }

  if (positional.length !== 1) {
    throw new Error(
      "Expected exactly one positional argument (slug). Run with --help for usage.",
    );
  }
  args.slug = positional[0];

  if (!args.title) {
    throw new Error("--title is required");
  }
  if (!/^[a-z0-9-]+$/.test(args.slug)) {
    throw new Error(
      `slug must be kebab-case (a-z, 0-9, -). Got: "${args.slug}"`,
    );
  }
  if (!Number.isInteger(args.minutes) || args.minutes <= 0) {
    throw new Error(`--minutes must be a positive integer. Got: ${args.minutes}`);
  }
  return args as Args;
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function mdxTemplate(args: Args): string {
  const prereqYaml =
    args.prereqs.length === 0
      ? "prerequisites: []"
      : `prerequisites:\n${args.prereqs.map((p) => `  - ${p}`).join("\n")}`;

  const practiceBlock = args.withExercise
    ? `practice:
  - kind: mcq
    prompt: "TODO: Сформулируйте один MCQ, проверяющий ключевую идею узла."
    options:
      - TODO option 1
      - TODO option 2
      - TODO option 3
      - TODO option 4
    answerIndex: 0
    explanation: "TODO: 1-2 предложения объяснения."
  - kind: code
    prompt: "TODO: Опишите задание (одно предложение)."
    starterFile: exercises/${args.slug}/starter.html
    solutionFile: exercises/${args.slug}/solution.html
    testsFile: exercises/${args.slug}/tests.js
    language: html`
    : `practice:
  - kind: mcq
    prompt: "TODO: Сформулируйте один MCQ, проверяющий ключевую идею узла."
    options:
      - TODO option 1
      - TODO option 2
      - TODO option 3
      - TODO option 4
    answerIndex: 0
    explanation: "TODO: 1-2 предложения объяснения."`;

  const flashcards = Array.from(
    { length: 6 },
    (_, i) =>
      `  - front: "TODO front #${i + 1}"\n    back: "TODO back #${i + 1}"`,
  ).join("\n");

  const masteryQuiz = Array.from(
    { length: 5 },
    (_, i) =>
      `  - kind: mcq
    prompt: "TODO mastery prompt #${i + 1}"
    options:
      - TODO option 1
      - TODO option 2
      - TODO option 3
      - TODO option 4
    answerIndex: 0
    explanation: "TODO: объяснение."`,
  ).join("\n");

  return `---
schemaVersion: 1
slug: ${args.slug}
title: ${args.title}
summary: "TODO: одно предложение — что узел даёт учащемуся."
status: draft
estimatedMinutes: ${args.minutes}
${prereqYaml}
learningOutcomes:
  - "TODO: что учащийся сможет делать после узла (глагол + объект)."
  - "TODO: ещё одна цель."
  - "TODO: ещё одна цель."
${practiceBlock}
flashcards:
${flashcards}
masteryQuiz:
${masteryQuiz}
---

## TODO: первая подсекция теории

Начните с короткого ментального крючка: почему эта тема вообще важна.

## TODO: вторая подсекция

Объясните ключевые понятия. Используйте короткие списки/таблицы там, где
форма помогает мысли. Код — в fenced блоках с указанием языка.

\`\`\`html
<!-- пример -->
\`\`\`

## TODO: типичные ошибки или практический паттерн

Покажите 1-2 случая, где новички ошибаются, и как правильно.

## Попробуйте

Конкретное действие, которое учащийся может выполнить сразу.
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const contentRoot = path.join(process.cwd(), "src", "content", "roles", args.role);
  const mdxPath = path.join(contentRoot, `${args.slug}.mdx`);
  const exerciseDir = path.join(contentRoot, "exercises", args.slug);

  // Check role dir exists. It must — `db:seed` is the source of truth for
  // role rows, and `content:sync` would skip MDX in a non-existent role.
  if (!(await exists(contentRoot))) {
    throw new Error(
      `Role directory does not exist: ${contentRoot}\n` +
        `Add the role in src/db/seed.ts first, then re-run pnpm db:seed.`,
    );
  }

  if (await exists(mdxPath)) {
    throw new Error(`Refusing to overwrite existing file: ${mdxPath}`);
  }

  await writeFile(mdxPath, mdxTemplate(args), "utf8");
  console.log(`✓ created ${path.relative(process.cwd(), mdxPath)}`);

  if (args.withExercise) {
    if (await exists(exerciseDir)) {
      console.log(
        `· exercise directory already exists: ${path.relative(process.cwd(), exerciseDir)} — skipped`,
      );
    } else {
      await mkdir(exerciseDir, { recursive: true });
      await writeFile(
        path.join(exerciseDir, "starter.html"),
        "<!doctype html>\n<html lang=\"ru\">\n  <head>\n    <meta charset=\"utf-8\" />\n    <title>TODO</title>\n  </head>\n  <body>\n    <!-- TODO: стартовая разметка для упражнения. -->\n    <script src=\"globals.js\"></script>\n    <script src=\"tests.js\"></script>\n  </body>\n</html>\n",
        "utf8",
      );
      await writeFile(
        path.join(exerciseDir, "solution.html"),
        "<!doctype html>\n<html lang=\"ru\">\n  <head>\n    <meta charset=\"utf-8\" />\n    <title>TODO</title>\n  </head>\n  <body>\n    <!-- TODO: эталонное решение. -->\n    <script src=\"globals.js\"></script>\n    <script src=\"tests.js\"></script>\n  </body>\n</html>\n",
        "utf8",
      );
      await writeFile(
        path.join(exerciseDir, "tests.js"),
        "// TODO: проверки. Используйте assertHasElement(selector) и __report({ok, message}).\n(function () {\n  function run() {\n    try {\n      // assertHasElement(\"selector\");\n      __report({ ok: true, message: \"TODO\" });\n    } catch (err) {\n      __report({ ok: false, message: err.message });\n    }\n  }\n  if (document.readyState === \"loading\") {\n    document.addEventListener(\"DOMContentLoaded\", run);\n  } else {\n    run();\n  }\n})();\n",
        "utf8",
      );
      console.log(
        `✓ created ${path.relative(process.cwd(), exerciseDir)}/ (starter.html, solution.html, tests.js)`,
      );
    }
  }

  console.log("");
  console.log("Next steps:");
  console.log(`  1. Fill in TODO sections in ${path.relative(process.cwd(), mdxPath)}`);
  console.log(`  2. Add "${args.slug}" to PLACEHOLDER_NODES in src/db/seed.ts if it's not there yet`);
  console.log(`  3. Run pnpm content:check to validate`);
  console.log(`  4. Run pnpm db:seed to upsert node + sync flashcards`);
  console.log(`  5. When everything is green, set status: published in frontmatter`);
}

main().catch((err) => {
  console.error("new:node failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
