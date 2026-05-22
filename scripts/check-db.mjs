#!/usr/bin/env node
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import * as dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
dotenv.config({ path: resolve(root, ".env.local") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

// Покажем только host:port + database name, без юзера/пароля.
const url = new URL(DATABASE_URL);
console.log(`Connected to ${url.hostname}:${url.port}${url.pathname}`);

const client = postgres(DATABASE_URL, { prepare: false, max: 1 });
try {
  const tableCheck = await client`
    SELECT table_schema, table_name FROM information_schema.tables
    WHERE table_name IN ('concept_explanations', 'nodes', 'roles')
    ORDER BY table_name
  `;
  console.log("Tables found:", tableCheck.map((t) => `${t.table_schema}.${t.table_name}`));

  const nodeCount = await client`SELECT COUNT(*)::int AS n FROM nodes`;
  console.log(`nodes total: ${nodeCount[0].n}`);

  const roleNames = await client`SELECT slug FROM roles ORDER BY slug`;
  console.log("roles:", roleNames.map((r) => r.slug));
} finally {
  await client.end();
}
