import { z } from "zod";

const isServer = typeof window === "undefined";

const serverSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid Postgres URL"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  STRIPE_SECRET_KEY: z.string().min(1, "STRIPE_SECRET_KEY is required"),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, "STRIPE_WEBHOOK_SECRET is required"),
  /** Включить verbose-логгер Drizzle. Установить DB_LOG=true в .env.local для отладки SQL. */
  DB_LOG: z.enum(["true", "false"]).optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1, "NEXT_PUBLIC_POSTHOG_KEY is required"),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().default("https://eu.i.posthog.com"),
  /** "on" — гостевой демо-режим без логина. "off" (по умолчанию) — полный auth. */
  NEXT_PUBLIC_DEMO_MODE: z.enum(["on", "off"]).default("off"),
});

const rawClient = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE,
};

const parsedClient = clientSchema.safeParse(rawClient);

if (!parsedClient.success) {
  console.error(
    "❌ Invalid public env vars:",
    parsedClient.error.flatten().fieldErrors,
  );
  throw new Error(
    "Invalid public environment variables. See .env.example for the contract.",
  );
}

const parsedServer = isServer
  ? serverSchema.safeParse({
      DATABASE_URL: process.env.DATABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
      DB_LOG: process.env.DB_LOG,
    })
  : null;

if (isServer && parsedServer && !parsedServer.success) {
  console.error(
    "❌ Invalid server env vars:",
    parsedServer.error.flatten().fieldErrors,
  );
  throw new Error(
    "Invalid server environment variables. See .env.example for the contract.",
  );
}

export const publicEnv = parsedClient.data;

type ServerEnv = z.infer<typeof serverSchema>;

export const serverEnv: ServerEnv = new Proxy({} as ServerEnv, {
  get(_target, prop: string) {
    if (!isServer) {
      throw new Error(
        `Attempted to access server env var "${prop}" on the client. ` +
          "Server-only vars must not be referenced in client bundles.",
      );
    }
    if (!parsedServer || !parsedServer.success) {
      throw new Error("Server env not initialized.");
    }
    return parsedServer.data[prop as keyof ServerEnv];
  },
});
