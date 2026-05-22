#!/usr/bin/env node
/**
 * Same as apply-0008.mjs, но читает env из .env.prod вместо .env.local.
 * Используется один раз — после vercel env pull .env.prod.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import postgres from "postgres";
import * as dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

dotenv.config({ path: resolve(root, ".env.prod") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set in .env.prod");
  process.exit(1);
}

const url = new URL(DATABASE_URL);
console.log(`Target: ${url.hostname}:${url.port}${url.pathname}`);

const sqlPath = resolve(root, "src/db/migrations/0008_concept_explanations.sql");
const sqlContent = readFileSync(sqlPath, "utf8");
const migrationHash = crypto.createHash("sha256").update(sqlContent).digest("hex");

const statements = sqlContent
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

console.log(`Applying 0008_concept_explanations — ${statements.length} statements`);

const client = postgres(DATABASE_URL, {
  prepare: false,
  connect_timeout: 60,
  idle_timeout: 5,
  max: 1,
});

try {
  // Если таблица уже есть — этот скрипт уже отрабатывал. Пропускаем.
  const exists = await client`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'concept_explanations' LIMIT 1
  `;
  if (exists.length > 0) {
    console.log("  concept_explanations уже существует — пропускаю DDL");
  } else {
    for (const [i, stmt] of statements.entries()) {
      const preview = stmt.replace(/\s+/g, " ").slice(0, 80);
      console.log(`  [${i + 1}/${statements.length}] ${preview}...`);
      await client.unsafe(stmt);
    }
  }

  const journalRow = await client`
    SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = ${migrationHash} LIMIT 1
  `;
  if (journalRow.length === 0) {
    await client`
      INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
      VALUES (${migrationHash}, ${Date.now()})
    `;
    console.log("  ✓ Recorded in drizzle.__drizzle_migrations");
  }

  const check = await client`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'concept_explanations'
    ORDER BY ordinal_position
  `;
  console.log(`  ✓ Table has ${check.length} columns: ${check.map((c) => c.column_name).join(", ")}`);
} catch (err) {
  console.error("Migration failed:", err);
  process.exit(1);
} finally {
  await client.end();
}
console.log("Done.");
