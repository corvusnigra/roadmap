import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { serverEnv } from "@/lib/env";
import * as schema from "@/db/schema";

declare global {
  var __roleroadmap_db__: ReturnType<typeof createDb> | undefined;
}

function createDb() {
  const client = postgres(serverEnv.DATABASE_URL, {
    max: 10,
    prepare: false,
  });
  return drizzle(client, { schema, logger: process.env.NODE_ENV !== "production" });
}

export const db = globalThis.__roleroadmap_db__ ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalThis.__roleroadmap_db__ = db;
}

export type Database = typeof db;
export { schema };
