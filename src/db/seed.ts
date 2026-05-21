import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });
loadDotenv();

import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq } from "drizzle-orm";
import postgres from "postgres";

import * as schema from "@/db/schema";
import { nodePrerequisites, nodes, roles } from "@/db/schema";
import { buildLevenchukNodeSeeds } from "@/scripts/levenchuk-curriculum";

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
  nodes: [
    // Domain 1: Архитектура агента и SDLC (15–20%)
    {
      slug: "agent-sdlc-integration",
      title: "Интеграция агентов в SDLC",
      summary:
        "Где агенты встают в жизненный цикл, какие шаги выполняют, входные/выходные данные и критерии успеха.",
      positionX: 0,
      positionY: 0,
      estimatedMinutes: 30,
      prerequisites: [],
    },
    {
      slug: "planning-reasoning-action",
      title: "Планирование, обоснование, действие",
      summary:
        "Разделение фазы планирования и исполнения; проверка плана и блокировка действия до утверждения.",
      positionX: 0,
      positionY: 140,
      estimatedMinutes: 30,
      prerequisites: ["agent-sdlc-integration"],
    },
    {
      slug: "autonomous-observability",
      title: "Наблюдаемость автономных агентов",
      summary:
        "Степень автономии, артефакты в стандартных инструментах, человеко-агентское взаимодействие без замедления.",
      positionX: 0,
      positionY: 280,
      estimatedMinutes: 30,
      prerequisites: ["planning-reasoning-action"],
    },
    // Domain 2: Инструменты и среда (20–25%)
    {
      slug: "agent-tools-selection",
      title: "Инструменты агента",
      summary:
        "Подбор средств агента, их настройка и управление разрешениями.",
      positionX: 380,
      positionY: 0,
      estimatedMinutes: 30,
      prerequisites: ["autonomous-observability"],
    },
    {
      slug: "mcp-servers",
      title: "MCP-серверы",
      summary:
        "Подключение MCP как инструмента: GitHub remote MCP, реестры, allowlists.",
      positionX: 380,
      positionY: 140,
      estimatedMinutes: 30,
      prerequisites: ["agent-tools-selection"],
    },
    {
      slug: "dev-environment-integration",
      title: "Интеграция в среды разработки",
      summary:
        "Контекст исполнения, scope по репозиторию/ветке, вызов из CI, автономные действия (ветки и PR).",
      positionX: 380,
      positionY: 280,
      estimatedMinutes: 30,
      prerequisites: ["mcp-servers"],
    },
    {
      slug: "safe-execution-error-handling",
      title: "Безопасное выполнение и обработка ошибок",
      summary:
        "Error handling, retries, fallbacks, эскалация и трассируемость действий агента.",
      positionX: 380,
      positionY: 420,
      estimatedMinutes: 30,
      prerequisites: ["dev-environment-integration"],
    },
    // Domain 3: Память, состояние, выполнение (10–15%)
    {
      slug: "memory-strategies",
      title: "Стратегии памяти агента",
      summary:
        "Краткосрочная / долгосрочная / внешняя; правила истечения, обрезки и сброса.",
      positionX: 760,
      positionY: 0,
      estimatedMinutes: 25,
      prerequisites: ["safe-execution-error-handling"],
    },
    {
      slug: "state-context-drift",
      title: "Состояние и смещение контекста",
      summary:
        "Фиксация хода задачи в артефактах, возобновление работы, обнаружение и исправление дрейфа.",
      positionX: 760,
      positionY: 140,
      estimatedMinutes: 30,
      prerequisites: ["memory-strategies"],
    },
    {
      slug: "memory-continuity",
      title: "Непрерывность памяти и состояния",
      summary:
        "Общий state между инструментами и средами; защита от устаревания и конфликтов контекста.",
      positionX: 760,
      positionY: 280,
      estimatedMinutes: 25,
      prerequisites: ["state-context-drift"],
    },
    // Domain 4: Оценка, анализ ошибок, настройка (15–20%)
    {
      slug: "evaluation-criteria",
      title: "Критерии успешности и сигналы оценки",
      summary:
        "Ожидаемые результаты и ограничения задачи; качественные и количественные сигналы; автоматические сканы как источник сигналов.",
      positionX: 1140,
      positionY: 0,
      estimatedMinutes: 30,
      prerequisites: ["memory-continuity"],
    },
    {
      slug: "failure-analysis",
      title: "Анализ сбоев агента",
      summary:
        "Логи, планы, трассировки, артефакты рабочих процессов; классификация первопричин: рассуждение, инструменты, контекст.",
      positionX: 1140,
      positionY: 140,
      estimatedMinutes: 30,
      prerequisites: ["evaluation-criteria"],
    },
    {
      slug: "behavior-tuning",
      title: "Настройка поведения агента",
      summary:
        "Тонкая настройка инструкций, рабочих процессов, ограничений; уточнение памяти и доступа к инструментам.",
      positionX: 1140,
      positionY: 280,
      estimatedMinutes: 25,
      prerequisites: ["failure-analysis"],
    },
    // Domain 5: Многоагентная координация (15–20%)
    {
      slug: "multi-agent-orchestration",
      title: "Оркестрация многоагентных систем",
      summary:
        "Шаблоны оркестрации, изоляция параллельных агентов, разрешение конфликтов изменений и противоречивых выходов.",
      positionX: 1520,
      positionY: 0,
      estimatedMinutes: 35,
      prerequisites: ["behavior-tuning"],
    },
    {
      slug: "multi-agent-observability",
      title: "Наблюдаемость многоагентных систем",
      summary:
        "Артефакты, пригодные для аудита, документирование решений и передач, постфактум анализ поведения.",
      positionX: 1520,
      positionY: 140,
      estimatedMinutes: 30,
      prerequisites: ["multi-agent-orchestration"],
    },
    {
      slug: "multi-agent-failures",
      title: "Отказы в многоагентных системах",
      summary:
        "Выявление неудачных и приостановленных исполнений; реакция на ухудшение; recovery-шаблоны и human-in-the-loop.",
      positionX: 1520,
      positionY: 280,
      estimatedMinutes: 30,
      prerequisites: ["multi-agent-observability"],
    },
    {
      slug: "multi-agent-lifecycle",
      title: "Жизненный цикл многоагентных процессов",
      summary:
        "Добавление, обновление и вывод агентов без нарушения активных рабочих процессов; сохранение аудируемости.",
      positionX: 1520,
      positionY: 420,
      estimatedMinutes: 25,
      prerequisites: ["multi-agent-failures"],
    },
    // Domain 6: Ограничители и подотчетность (10–15%)
    {
      slug: "autonomy-levels",
      title: "Уровни автономии",
      summary:
        "Классификация действий по риску; назначение уровней автономии для скорости + безопасности.",
      positionX: 1900,
      positionY: 0,
      estimatedMinutes: 25,
      prerequisites: ["multi-agent-lifecycle"],
    },
    {
      slug: "guardrails-human-in-loop",
      title: "Ограничители и human-in-the-loop",
      summary:
        "Действия с обязательным одобрением; блокировка нарушений политик; принцип минимальных прав; контроль необратимых изменений.",
      positionX: 1900,
      positionY: 140,
      estimatedMinutes: 30,
      prerequisites: ["autonomy-levels"],
    },
  ],
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

const ROLES: RoleConfig[] = [FRONTEND, GH600, LEVENCHUK];

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
