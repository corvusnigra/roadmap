#!/usr/bin/env node
/**
 * Prod-вариант content:sync через PostgREST + retry.
 *
 * Зачем не drizzle: pooler Supabase (port 6543) рвёт длинные сессии
 * INSERT'ов c ETIMEDOUT. PostgREST через HTTPS с `Connection: close`
 * на каждый запрос обходит проблему.
 *
 * Использование:
 *   1. vercel env pull .env.prod --environment=production --yes
 *   2. node scripts/content-sync-prod.mjs
 *   3. rm .env.prod
 *
 * Делает full sync для каждой роли с `_role.json` в `src/content/roles/*\/`.
 * Старые роли без `_role.json` пропускаются (легаси-путь через db:seed).
 *
 * Карточки: flashcard (из frontmatter.flashcards) + mcq (из masteryQuiz
 * и practice[kind=mcq]). Форматирование MCQ идентично функции formatMcqAnswer
 * в src/lib/content/sync.ts — при изменении формата обновлять оба файла.
 *
 * Стратегия обновления карточек (Fix 6 — diff-sync):
 *   1. Upsert карточек через PostgREST on_conflict=node_id,prompt,kind
 *      (Prefer: resolution=merge-duplicates) — вставляем новые, обновляем
 *      изменённые, не трогаем неизменившиеся.
 *   2. После upsert удаляем только «stale» строки — те, чьего prompt+kind
 *      нет в текущем наборе MDX.
 *   Нет «wipe then reinsert» — нет деструктивного окна.
 */
import { resolve, dirname } from "node:path";
import { readFile, readdir, access, constants } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import * as dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
dotenv.config({ path: resolve(root, ".env.prod") });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env.prod");
  console.error("Запусти: vercel env pull .env.prod --environment=production --yes");
  process.exit(1);
}

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/^"|"$/g, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY.replace(/^"|"$/g, "");

console.log(`Target: ${SUPA_URL}`);

async function rest(method, path, body, prefer = "return=representation") {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
        method,
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Connection: "close",
          Prefer: prefer,
        },
        body: body == null ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
      return text ? JSON.parse(text) : null;
    } catch (err) {
      if (attempt === 5) throw err;
      console.warn(`  ⚠ ${method} ${path} attempt ${attempt}: ${err.message}. retry...`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

async function fileExists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

function positionFor(level, idx) {
  return { x: 120 + level * 280, y: 80 + idx * 140 };
}

/**
 * Форматирует ответ MCQ в Markdown.
 * ВАЖНО: логика идентична src/lib/content/sync.ts → formatMcqAnswer.
 * При изменении формата обновлять оба файла.
 *
 * Правильный вариант помечается жирным + ✓; остальные — простой li.
 * Затем через пустую строку идёт explanation.
 */
function formatMcqAnswer(options, answerIndex, explanation) {
  const opts = options
    .map((o, i) => (i === answerIndex ? `**${o}** ✓` : o))
    .join("\n- ");
  return `- ${opts}\n\n${explanation}`;
}

/**
 * Проецирует frontmatter MDX-узла в плоский список card-объектов.
 * ВАЖНО: логика идентична src/lib/content/sync.ts → projectMdxToCards.
 */
function projectMdxToCards(nodeId, fm) {
  const cards = [];
  for (const c of fm.flashcards ?? []) {
    cards.push({ node_id: nodeId, prompt: c.front, answer_markdown: c.back, kind: "flashcard" });
  }
  for (const m of fm.masteryQuiz ?? []) {
    cards.push({
      node_id: nodeId,
      prompt: m.prompt,
      answer_markdown: formatMcqAnswer(m.options, m.answerIndex, m.explanation),
      kind: "mcq",
    });
  }
  for (const p of fm.practice ?? []) {
    if (p.kind !== "mcq") continue;
    if (!p.prompt || !p.options || p.answerIndex === undefined || !p.explanation) continue;
    cards.push({
      node_id: nodeId,
      prompt: p.prompt,
      answer_markdown: formatMcqAnswer(p.options, p.answerIndex, p.explanation),
      kind: "mcq",
    });
  }
  return cards;
}

const CONTENT_ROOT = resolve(root, "src/content/roles");
const roleSlugs = (await readdir(CONTENT_ROOT, { withFileTypes: true }))
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

const stats = { roles: 0, nodes: 0, edges: 0, cards: 0, cardsDeleted: 0 };

for (const roleSlug of roleSlugs) {
  const metaPath = resolve(CONTENT_ROOT, roleSlug, "_role.json");
  if (!(await fileExists(metaPath))) {
    console.log(`· skip "${roleSlug}" — no _role.json (legacy через db:seed)`);
    continue;
  }
  const meta = JSON.parse(await readFile(metaPath, "utf8"));
  console.log(`\n→ ${roleSlug} (${meta.status})`);

  // 1. Upsert role
  const roleRows = await rest(
    "POST",
    "roles?on_conflict=slug",
    { slug: roleSlug, title: meta.title, summary: meta.summary, status: meta.status },
    "resolution=merge-duplicates,return=representation",
  );
  const roleId = roleRows[0].id;
  stats.roles += 1;

  // 2. Загружаем MDX узлов
  const mdxFiles = (await readdir(resolve(CONTENT_ROOT, roleSlug)))
    .filter((f) => f.endsWith(".mdx"));
  const loaded = [];
  for (const file of mdxFiles) {
    const raw = await readFile(resolve(CONTENT_ROOT, roleSlug, file), "utf8");
    const fm = matter(raw).data;
    loaded.push({
      slug: file.replace(/\.mdx$/, ""),
      title: fm.title,
      summary: fm.summary,
      estimatedMinutes: fm.estimatedMinutes,
      level: fm.level ?? 0,
      prerequisites: fm.prerequisites ?? [],
      flashcards: fm.flashcards ?? [],
      masteryQuiz: fm.masteryQuiz ?? [],
      practice: fm.practice ?? [],
    });
  }

  // 3. Группировка по level → idxInLevel
  const byLevel = new Map();
  for (const n of loaded) {
    const bucket = byLevel.get(n.level) ?? [];
    bucket.push(n);
    byLevel.set(n.level, bucket);
  }
  for (const [level, group] of byLevel.entries()) {
    group.forEach((n, idx) => { n._pos = positionFor(level, idx); });
  }

  // 4. Bulk upsert nodes
  const nodePayload = loaded.map((n) => ({
    role_id: roleId,
    slug: n.slug,
    title: n.title,
    summary: n.summary,
    position_x: n._pos.x,
    position_y: n._pos.y,
    estimated_minutes: n.estimatedMinutes,
  }));
  const inserted = await rest(
    "POST",
    "nodes?on_conflict=role_id,slug",
    nodePayload,
    "resolution=merge-duplicates,return=representation",
  );
  stats.nodes += inserted.length;
  console.log(`  ✓ ${inserted.length} nodes`);

  const slugToId = new Map(inserted.map((n) => [n.slug, n.id]));

  // 5. Edges
  const edges = [];
  for (const n of loaded) {
    for (const prereqSlug of n.prerequisites) {
      const fromId = slugToId.get(n.slug);
      const toId = slugToId.get(prereqSlug);
      if (fromId && toId) edges.push({ node_id: fromId, prerequisite_node_id: toId });
    }
  }
  if (edges.length > 0) {
    await rest(
      "POST",
      "node_prerequisites?on_conflict=node_id,prerequisite_node_id",
      edges,
      "resolution=ignore-duplicates,return=minimal",
    );
  }
  stats.edges += edges.length;
  console.log(`  ✓ ${edges.length} edges`);

  // 6. Diff-sync карточек (flashcard + mcq) — Fix 6.
  //
  // Алгоритм:
  //   a) Upsert всех карточек через on_conflict=node_id,prompt,kind
  //      (merge-duplicates обновляет answer_markdown если изменился).
  //   b) Получаем текущий список карточек из БД для этой роли.
  //   c) Удаляем только те, чей (prompt, kind) не присутствует в новом наборе.
  //
  // Это безопаснее wipe+reinsert: нет окна, когда карточки исчезают.

  const allNewCards = [];
  for (const n of loaded) {
    const nodeId = slugToId.get(n.slug);
    if (!nodeId) continue;
    allNewCards.push(...projectMdxToCards(nodeId, n));
  }

  // a) Upsert новых/изменившихся карточек чанками по 50
  let cardUpsertCount = 0;
  for (let i = 0; i < allNewCards.length; i += 50) {
    const chunk = allNewCards.slice(i, i + 50);
    await rest(
      "POST",
      "skill_cards?on_conflict=node_id,prompt,kind",
      chunk,
      "resolution=merge-duplicates,return=minimal",
    );
    cardUpsertCount += chunk.length;
  }

  // b) Читаем текущие карточки из БД для всех узлов этой роли
  const nodeIds = [...slugToId.values()].map((id) => `"${id}"`).join(",");
  const existingCards = await rest(
    "GET",
    `skill_cards?node_id=in.(${nodeIds})&select=id,node_id,prompt,kind`,
    null,
    "return=representation",
  );

  // c) Определяем stale: те, чей prompt+kind не в новом наборе
  // Строим Set ключей нового набора: "nodeId::kind::prompt"
  const newCardKeys = new Set(
    allNewCards.map((c) => `${c.node_id}::${c.kind}::${c.prompt}`),
  );
  const staleIds = (existingCards ?? [])
    .filter((c) => !newCardKeys.has(`${c.node_id}::${c.kind}::${c.prompt}`))
    .map((c) => `"${c.id}"`);

  if (staleIds.length > 0) {
    await rest(
      "DELETE",
      `skill_cards?id=in.(${staleIds.join(",")})`,
      null,
      "return=minimal",
    );
    stats.cardsDeleted += staleIds.length;
    console.log(`  ✓ ${staleIds.length} stale cards deleted`);
  }

  stats.cards += cardUpsertCount;
  console.log(`  ✓ ${cardUpsertCount} cards upserted (flashcard + mcq)`);
}

console.log(
  `\n✓ done: roles=${stats.roles}, nodes=${stats.nodes}, edges=${stats.edges}, cards=${stats.cards}, stale_deleted=${stats.cardsDeleted}`,
);
