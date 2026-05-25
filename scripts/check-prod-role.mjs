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
  const roles = await client`SELECT slug, status FROM roles ORDER BY slug`;
  console.log("roles on prod:", roles);
  const javaRole = roles.find((r) => r.slug === "java-middle-interview");
  if (javaRole) {
    const nodeCount = await client`
      SELECT COUNT(*)::int AS n FROM nodes n
      JOIN roles r ON r.id = n.role_id WHERE r.slug = 'java-middle-interview'
    `;
    console.log(`java-middle-interview nodes: ${nodeCount[0].n}`);
  } else {
    console.log("java-middle-interview NOT seeded yet");
  }
} finally {
  await client.end();
}
