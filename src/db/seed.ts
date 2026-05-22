import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });
loadDotenv();

import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq } from "drizzle-orm";
import postgres from "postgres";

import * as schema from "@/db/schema";
import { nodePrerequisites, nodes, roles } from "@/db/schema";
import { buildGh600NodeSeeds } from "@/scripts/gh600-curriculum";
import { buildLevenchukNodeSeeds } from "@/scripts/levenchuk-curriculum";
import { buildVibecodingNodeSeeds } from "@/scripts/vibecoding-curriculum";

interface RoleSeed {
  slug: string;
  title: string;
  summary: string;
  status: "draft" | "published";
}

interface NodeSeed {
  slug: string;
  title: string;
  summary: string;
  positionX: number;
  positionY: number;
  estimatedMinutes: number;
  prerequisites: string[];
}

interface RoleConfig {
  role: RoleSeed;
  nodes: NodeSeed[];
}

// ----- Role 1: Frontend Developer (demo / sandbox) ----------------------

const FRONTEND: RoleConfig = {
  role: {
    slug: "frontend-developer",
    title: "Frontend-разработчик",
    summary:
      "От нуля до junior-уровня: основы веба, HTML, CSS, JS, React, инструменты.",
    status: "published",
  },
  nodes: [
    {
      slug: "how-the-web-works",
      title: "Как работает Web",
      summary: "Запросы, ответы, DNS, основы HTTP.",
      positionX: 0,
      positionY: 0,
      estimatedMinutes: 25,
      prerequisites: [],
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
  ],
};

// ----- Role 2: GH-600 Agentic AI Systems (Microsoft cert) ---------------

const GH600: RoleConfig = {
  role: {
    slug: "agentic-ai-gh600",
    title: "Агентические системы ИИ (GH-600)",
    summary:
      "Подготовка к Microsoft GH-600: проектирование, инструменты, память, оценка, многоагентная координация и ограничители для агентов в SDLC через GitHub.",
    status: "published",
  },
  nodes: buildGh600NodeSeeds(),
};


// ----- Role 3: Интеллект-стек Левенчука ---------------------------------

const LEVENCHUK: RoleConfig = {
  role: {
    slug: "levenchuk-stack",
    title: "Интеллект-стек Левенчука",
    summary:
      "Семь уровней трансдисциплин: от собранности и онтологики до системного предпринимательства и инженерии личности. Курс по работам ШСМ и блогу ailev.",
    status: "published",
  },
  nodes: buildLevenchukNodeSeeds(),
};

// ----- Role 4: Вайбкодинг -----------------------------------------------

const VIBECODING: RoleConfig = {
  role: {
    slug: "vibecoding",
    title: "Вайбкодинг",
    summary:
      "Разработка через диалог с LLM-ассистентом (Claude Code / Cursor / Aider). Пять уровней: ментальная модель → вход в контекст → циклы → дисциплина итераций → команда и безопасность.",
    status: "published",
  },
  nodes: buildVibecodingNodeSeeds(),
};

const ROLES: RoleConfig[] = [FRONTEND, GH600, LEVENCHUK, VIBECODING];

async function seedRole(
  db: ReturnType<typeof drizzle>,
  config: RoleConfig,
): Promise<void> {
  console.log(`→ seeding role "${config.role.slug}" with ${config.nodes.length} nodes…`);

  const [role] = await db
    .insert(roles)
    .values(config.role)
    .onConflictDoUpdate({
      target: roles.slug,
      set: {
        title: config.role.title,
        summary: config.role.summary,
        status: config.role.status,
      },
    })
    .returning();

  if (!role) {
    throw new Error(`Failed to upsert role ${config.role.slug}`);
  }

  const slugToId = new Map<string, string>();

  for (const node of config.nodes) {
    // Scope lookup to the current role — without this, two roles with the
    // same slug would silently overwrite each other on subsequent seeds
    // (code-review C1). The DB-level UNIQUE(role_id, slug) constraint
    // catches the case as well, but defending in both places is cheap.
    const existing = await db
      .select()
      .from(nodes)
      .where(and(eq(nodes.slug, node.slug), eq(nodes.roleId, role.id)))
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

  for (const node of config.nodes) {
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

  console.log(`  ✓ seeded role "${role.slug}"`);
}

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run the seed script.");
  }

  const client = postgres(databaseUrl, { max: 1, prepare: false });
  const db = drizzle(client, { schema });

  try {
    for (const config of ROLES) {
      await seedRole(db, config);
    }
    console.log(
      `✓ seeded ${ROLES.length} role(s), ${ROLES.reduce(
        (n, r) => n + r.nodes.length,
        0,
      )} node(s) total`,
    );
  } finally {
    await client.end();
  }
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("seed failed:", err);
    process.exit(1);
  });
