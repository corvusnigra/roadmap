import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });
loadDotenv();

import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";

import * as schema from "@/db/schema";
import { nodePrerequisites, nodes, roles } from "@/db/schema";

const FRONTEND_ROLE = {
  slug: "frontend-developer",
  title: "Frontend-разработчик",
  summary:
    "От нуля до junior-уровня: основы веба, HTML, CSS, JS, React, инструменты.",
  status: "published" as const,
};

const PLACEHOLDER_NODES = [
  {
    slug: "how-the-web-works",
    title: "Как работает Web",
    summary: "Запросы, ответы, DNS, основы HTTP.",
    positionX: 0,
    positionY: 0,
    estimatedMinutes: 25,
    prerequisites: [] as string[],
  },
  {
    slug: "html-document-structure",
    title: "Структура HTML-документа",
    summary: "Doctype, <head>, <meta>, <body>.",
    positionX: 200,
    positionY: 0,
    estimatedMinutes: 20,
    prerequisites: ["how-the-web-works"],
  },
  {
    slug: "html-semantics",
    title: "Семантика HTML",
    summary: "<section>, <article>, <header>, <nav>, <aside>.",
    positionX: 400,
    positionY: 0,
    estimatedMinutes: 25,
    prerequisites: ["html-document-structure"],
  },
  {
    slug: "css-box-model",
    title: "CSS Box Model",
    summary: "Контент, padding, border, margin, box-sizing.",
    positionX: 600,
    positionY: 0,
    estimatedMinutes: 25,
    prerequisites: ["html-semantics"],
  },
  {
    slug: "css-flexbox",
    title: "CSS Flexbox",
    summary: "Главная/побочная ось, justify-content, align-items, gap.",
    positionX: 800,
    positionY: 0,
    estimatedMinutes: 30,
    prerequisites: ["css-box-model"],
  },
] as const;

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run the seed script.");
  }

  const client = postgres(databaseUrl, { max: 1, prepare: false });
  const db = drizzle(client, { schema });

  console.log("→ seeding role and placeholder nodes…");

  const [role] = await db
    .insert(roles)
    .values(FRONTEND_ROLE)
    .onConflictDoUpdate({
      target: roles.slug,
      set: {
        title: FRONTEND_ROLE.title,
        summary: FRONTEND_ROLE.summary,
        status: FRONTEND_ROLE.status,
      },
    })
    .returning();

  if (!role) {
    throw new Error("Failed to upsert role");
  }

  const slugToId = new Map<string, string>();

  for (const node of PLACEHOLDER_NODES) {
    const existing = await db
      .select()
      .from(nodes)
      .where(eq(nodes.slug, node.slug))
      .limit(1);

    let id = existing[0]?.id;

    if (id) {
      await db
        .update(nodes)
        .set({
          title: node.title,
          summary: node.summary,
          positionX: node.positionX,
          positionY: node.positionY,
          estimatedMinutes: node.estimatedMinutes,
          roleId: role.id,
        })
        .where(eq(nodes.id, id));
    } else {
      const [inserted] = await db
        .insert(nodes)
        .values({
          roleId: role.id,
          slug: node.slug,
          title: node.title,
          summary: node.summary,
          positionX: node.positionX,
          positionY: node.positionY,
          estimatedMinutes: node.estimatedMinutes,
        })
        .returning();
      if (!inserted) throw new Error(`Failed to insert node ${node.slug}`);
      id = inserted.id;
    }

    slugToId.set(node.slug, id);
  }

  for (const node of PLACEHOLDER_NODES) {
    const nodeId = slugToId.get(node.slug);
    if (!nodeId) continue;
    for (const prereqSlug of node.prerequisites) {
      const prereqId = slugToId.get(prereqSlug);
      if (!prereqId) continue;
      await db
        .insert(nodePrerequisites)
        .values({ nodeId, prerequisiteNodeId: prereqId })
        .onConflictDoNothing();
    }
  }

  console.log(`✓ seeded role '${role.slug}' with ${PLACEHOLDER_NODES.length} nodes`);

  await client.end();
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("seed failed:", err);
    process.exit(1);
  });
