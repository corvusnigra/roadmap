#!/usr/bin/env node
/**
 * Догружает skill_cards только для узлов java-middle-interview, у
 * которых их 0. По одному узлу за HTTP-запрос с keep-alive: false.
 */
import { resolve, dirname } from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import postgres from "postgres";
import * as dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
dotenv.config({ path: resolve(root, ".env.prod") });

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/^"|"$/g, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY.replace(/^"|"$/g, "");

async function rest(method, path, body) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
        method,
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Connection: "close",
          Prefer: "return=minimal",
        },
        body: body == null ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
      return;
    } catch (err) {
      if (attempt === 5) throw err;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

// 1. Найти missing nodes через postgres (read работает стабильно)
const pg = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, connect_timeout: 30 });
const missing = await pg`
  SELECT n.id, n.slug
  FROM nodes n
  JOIN roles r ON r.id = n.role_id
  LEFT JOIN skill_cards s ON s.node_id = n.id
  WHERE r.slug = 'java-middle-interview' AND s.id IS NULL
  GROUP BY n.id, n.slug
  ORDER BY n.slug
`;
await pg.end();
console.log(`Missing cards for ${missing.length} nodes`);

// 2. Для каждого — прочитать MDX и заинсертить cards отдельным запросом
const mdxDir = resolve(root, "src/content/roles/java-middle-interview");

for (const node of missing) {
  const file = resolve(mdxDir, `${node.slug}.mdx`);
  const raw = await readFile(file, "utf8");
  const fm = matter(raw).data;
  const cards = [];
  for (const c of fm.flashcards ?? []) {
    cards.push({ node_id: node.id, prompt: c.front, answer_markdown: c.back, kind: "flashcard" });
  }
  for (const m of fm.masteryQuiz ?? []) {
    const opts = m.options.map((o, i) => (i === m.answerIndex ? `**${o}** ✓` : o)).join("\n- ");
    cards.push({ node_id: node.id, prompt: m.prompt, answer_markdown: `- ${opts}\n\n${m.explanation}`, kind: "mcq" });
  }
  for (const p of fm.practice ?? []) {
    const opts = p.options.map((o, i) => (i === p.answerIndex ? `**${o}** ✓` : o)).join("\n- ");
    cards.push({ node_id: node.id, prompt: p.prompt, answer_markdown: `- ${opts}\n\n${p.explanation}`, kind: "mcq" });
  }
  if (cards.length === 0) {
    console.log(`  · ${node.slug}: 0 cards in MDX`);
    continue;
  }
  await rest("POST", "skill_cards", cards);
  console.log(`  ✓ ${node.slug}: ${cards.length} cards`);
}

console.log("\nDone.");
