#!/usr/bin/env node
/**
 * Применяет миграцию 0008_concept_explanations.sql напрямую через
 * postgres-js, минуя drizzle-kit migrate (drizzle-kit таймаутится на
 * Supabase pooler — известная проблема).
 *
 * После выполнения добавляет запись в drizzle.__drizzle_migrations,
 * чтобы будущие `drizzle-kit migrate` не пытались переприменить.
 *
 * Использование:
 *   node scripts/apply-0008.mjs
 *
 * Требует DATABASE_URL в .env.local (pooled URL, порт 6543).
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import postgres from "postgres";
import * as dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

dotenv.config({ path: resolve(root, ".env.local") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set (looked in .env.local)");
  process.exit(1);
}

const sqlPath = resolve(root, "src/db/migrations/0008_concept_explanations.sql");
const sqlContent = readFileSync(sqlPath, "utf8");

// Drizzle ожидает hash файла в __drizzle_migrations для дедупликации.
const migrationHash = crypto.createHash("sha256").update(sqlContent).digest("hex");

// Statements разделены маркером `--> statement-breakpoint`.
const statements = sqlContent
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

console.log(`Applying 0008_concept_explanations — ${statements.length} statements`);

const client = postgres(DATABASE_URL, {
  prepare: false,
  // Хватит времени на медленный pooler handshake.
  connect_timeout: 60,
  idle_timeout: 5,
  max: 1,
});

try {
  for (const [i, stmt] of statements.entries()) {
    const preview = stmt.replace(/\s+/g, " ").slice(0, 80);
    console.log(`  [${i + 1}/${statements.length}] ${preview}...`);
    await client.unsafe(stmt);
  }

  // Регистрируем миграцию в drizzle's journal-table. Формат столбцов:
  // id (serial), hash (text), created_at (bigint, ms unix).
  const journalRow = await client`
    SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = ${migrationHash} LIMIT 1
  `;
  if (journalRow.length === 0) {
    await client`
      INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
      VALUES (${migrationHash}, ${Date.now()})
    `;
    console.log("  ✓ Recorded in drizzle.__drizzle_migrations");
  } else {
    console.log("  ✓ Already recorded (hash matched)");
  }

  // Проверяем, что таблица реально создалась.
  const check = await client`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'concept_explanations'
    ORDER BY ordinal_position
  `;
  console.log(`  ✓ Table created with ${check.length} columns: ${check.map((c) => c.column_name).join(", ")}`);
} catch (err) {
  console.error("Migration failed:", err);
  process.exit(1);
} finally {
  await client.end();
}
console.log("Done.");
