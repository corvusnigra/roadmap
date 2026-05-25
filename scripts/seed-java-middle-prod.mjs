#!/usr/bin/env node
/**
 * Seed роли java-middle-interview на prod через raw fetch к PostgREST.
 * Раскладываем по chunks, каждый chunk = отдельный fetch с keep-alive: false,
 * чтобы Node 24 не реюзал «протухший» TLS-коннект (откуда ECONNRESET у supabase-js).
 */
import { resolve, dirname } from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import * as dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
dotenv.config({ path: resolve(root, ".env.prod") });

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/^"|"$/g, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY.replace(/^"|"$/g, "");

console.log(`Target: ${SUPA_URL}`);

async function rest(method, path, body, prefer = "") {
  const url = `${SUPA_URL}/rest/v1/${path}`;
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    Connection: "close", // не реюзать TLS-коннект — обход ECONNRESET в Node 24
    Prefer: prefer || "return=representation",
  };
  // Ретрай на сетевую ошибку — раз. Если не помогает — выкидываем.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body == null ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
      }
      return text ? JSON.parse(text) : null;
    } catch (err) {
      if (attempt === 3) throw err;
      console.warn(`  ⚠ ${method} ${path} attempt ${attempt} failed: ${err.message}. retry...`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

// Загружаем curriculum через дочерний tsx-процесс — единый источник.
const { spawn } = await import("node:child_process");
const { topics, seeds } = await new Promise((res, rej) => {
  const proc = spawn(
    "pnpm",
    [
      "tsx",
      "-e",
      `import('./src/scripts/java-middle-curriculum').then(m => { process.stdout.write(JSON.stringify({ topics: m.JAVA_MIDDLE_TOPICS, seeds: m.buildJavaMiddleNodeSeeds() })); });`,
    ],
    { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
  );
  let stdout = "";
  let stderr = "";
  proc.stdout.on("data", (d) => (stdout += d));
  proc.stderr.on("data", (d) => (stderr += d));
  proc.on("close", (code) => {
    if (code !== 0) return rej(new Error(`tsx exited ${code}: ${stderr}`));
    res(JSON.parse(stdout.slice(stdout.indexOf("{"))));
  });
});
console.log(`Loaded ${topics.length} topics, ${seeds.length} seeds`);

// 1. Upsert role
const roleRows = await rest(
  "POST",
  "roles?on_conflict=slug",
  {
    slug: "java-middle-interview",
    title: "Java Middle Interview",
    summary:
      "Подготовка к собесу на Java Middle: 36 must-have тем (4+/8 частота по 8 разборам Sber/T-Bank/AlfaBank/VK/Ozon/Yandex/Лига). Семь уровней: Core → Collections → Concurrency → JVM → Spring → DB → System Design.",
    status: "published",
  },
  "resolution=merge-duplicates,return=representation",
);
const roleId = roleRows[0].id;
console.log(`  ✓ role id=${roleId}`);

// 2. Bulk upsert nodes
const nodeRows = seeds.map((s) => ({
  role_id: roleId,
  slug: s.slug,
  title: s.title,
  summary: s.summary,
  position_x: s.positionX,
  position_y: s.positionY,
  estimated_minutes: s.estimatedMinutes,
}));
const insertedNodes = await rest(
  "POST",
  "nodes?on_conflict=role_id,slug",
  nodeRows,
  "resolution=merge-duplicates,return=representation",
);
console.log(`  ✓ ${insertedNodes.length} nodes upserted`);

const slugToId = new Map(insertedNodes.map((n) => [n.slug, n.id]));

// 3. Bulk insert prerequisites — ON CONFLICT DO NOTHING
const edges = [];
for (const s of seeds) {
  for (const prereqSlug of s.prerequisites) {
    const fromId = slugToId.get(s.slug);
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
console.log(`  ✓ ${edges.length} prerequisite edges`);

// 4. Skill cards из MDX
const mdxDir = resolve(root, "src/content/roles/java-middle-interview");
const files = (await readdir(mdxDir)).filter((f) => f.endsWith(".mdx"));
const allCards = [];
for (const file of files) {
  const slug = file.replace(/\.mdx$/, "");
  const nodeId = slugToId.get(slug);
  if (!nodeId) continue;
  const raw = await readFile(resolve(mdxDir, file), "utf8");
  const fm = matter(raw).data;
  for (const c of fm.flashcards ?? []) {
    allCards.push({ node_id: nodeId, prompt: c.front, answer_markdown: c.back, kind: "flashcard" });
  }
  for (const m of fm.masteryQuiz ?? []) {
    const opts = m.options.map((o, i) => (i === m.answerIndex ? `**${o}** ✓` : o)).join("\n- ");
    allCards.push({ node_id: nodeId, prompt: m.prompt, answer_markdown: `- ${opts}\n\n${m.explanation}`, kind: "mcq" });
  }
  for (const p of fm.practice ?? []) {
    const opts = p.options.map((o, i) => (i === p.answerIndex ? `**${o}** ✓` : o)).join("\n- ");
    allCards.push({ node_id: nodeId, prompt: p.prompt, answer_markdown: `- ${opts}\n\n${p.explanation}`, kind: "mcq" });
  }
}

// Удаляем старые карточки только для этой роли (идемпотентность).
// PostgREST DELETE требует точный фильтр.
const nodeIdList = [...slugToId.values()].map((id) => `"${id}"`).join(",");
await rest("DELETE", `skill_cards?node_id=in.(${nodeIdList})`, null, "return=minimal");

// Insert чанками по 50 — снижаем риск таймаута на огромном payload.
for (let i = 0; i < allCards.length; i += 50) {
  const chunk = allCards.slice(i, i + 50);
  await rest("POST", "skill_cards", chunk, "return=minimal");
}
console.log(`  ✓ ${allCards.length} skill_cards inserted`);

console.log("\n✓ Java Middle Interview прогружен на prod");
