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

const CONTENT_ROOT = resolve(root, "src/content/roles");
const roleSlugs = (await readdir(CONTENT_ROOT, { withFileTypes: true }))
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

const stats = { roles: 0, nodes: 0, edges: 0, cards: 0 };

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

  // 6. Flashcards — wipe + reinsert per node (proven pattern против flaky pooler)
  const allCards = [];
  for (const n of loaded) {
    const nodeId = slugToId.get(n.slug);
    if (!nodeId) continue;
    for (const c of n.flashcards) {
      allCards.push({ node_id: nodeId, prompt: c.front, answer_markdown: c.back, kind: "flashcard" });
    }
  }
  // Snapshot existing card prompts via PostgREST select, чтобы знать что удалить
  const nodeIds = [...slugToId.values()].map((id) => `"${id}"`).join(",");
  await rest("DELETE", `skill_cards?node_id=in.(${nodeIds})&kind=eq.flashcard`, null, "return=minimal");
  // Insert chunks of 50 (network friendly)
  for (let i = 0; i < allCards.length; i += 50) {
    const chunk = allCards.slice(i, i + 50);
    await rest("POST", "skill_cards", chunk, "return=minimal");
  }
  stats.cards += allCards.length;
  console.log(`  ✓ ${allCards.length} flashcards (wipe+reinsert)`);
}

console.log(
  `\n✓ done: roles=${stats.roles}, nodes=${stats.nodes}, edges=${stats.edges}, flashcards=${stats.cards}`,
);
