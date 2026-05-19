import { config as loadDotenv } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Pick up Supabase / Postgres credentials from .env.local first, then fall
// back to .env so CI can override via plain env vars.
loadDotenv({ path: ".env.local" });
loadDotenv();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required for drizzle-kit. Set it in .env.local or your shell.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  schemaFilter: ["public"],
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
