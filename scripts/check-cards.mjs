#!/usr/bin/env node
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import * as dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
dotenv.config({ path: resolve(root, ".env.prod") });

const client = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, connect_timeout: 30 });
try {
  const counts = await client`
    SELECT n.slug, COUNT(s.id)::int AS cards
    FROM nodes n
    JOIN roles r ON r.id = n.role_id
    LEFT JOIN skill_cards s ON s.node_id = n.id
    WHERE r.slug = 'java-middle-interview'
    GROUP BY n.slug
    ORDER BY n.slug
  `;
  const total = counts.reduce((a, c) => a + c.cards, 0);
  console.log(`Total cards: ${total}`);
  console.log(`Nodes with 0 cards: ${counts.filter((c) => c.cards === 0).length}/${counts.length}`);
  for (const c of counts.slice(0, 10)) console.log(`  ${c.slug}: ${c.cards}`);
} finally {
  await client.end();
}
