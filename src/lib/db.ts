import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { serverEnv } from "@/lib/env";
import * as schema from "@/db/schema";

/**
 * ВАЖНО — обход Supabase RLS:
 * Этот клиент подключается напрямую к Postgres через DATABASE_URL (service-role
 * уровень доступа) и НЕ проходит через Supabase RLS. Row-level security здесь
 * не применяется автоматически.
 *
 * Защита обеспечивается исключительно на уровне приложения:
 *  - каждый запрос к таблицам с данными пользователя ОБЯЗАН содержать явный
 *    предикат userId (eq(table.userId, user.id)) — иначе вернутся чужие данные;
 *  - server-actions обязаны аутентифицировать пользователя ПЕРЕД любым запросом.
 *
 * Не используйте этот db-клиент для «публичных» выборок без userId-фильтра,
 * если таблица содержит per-user данные.
 */

declare global {
  var __roleroadmap_db__: ReturnType<typeof createDb> | undefined;
}

function createDb() {
  const client = postgres(serverEnv.DATABASE_URL, {
    max: 10,
    prepare: false,
  });
  // Логгер включается явно через DB_LOG=true — не через NODE_ENV,
  // чтобы не засорять prod-логи при случайном деплое с debug-настройками.
  const enableLogging = serverEnv.DB_LOG === "true";
  return drizzle(client, { schema, logger: enableLogging });
}

export const db = globalThis.__roleroadmap_db__ ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalThis.__roleroadmap_db__ = db;
}

export type Database = typeof db;
export { schema };
