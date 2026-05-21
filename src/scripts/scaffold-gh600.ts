/**
 * One-shot scaffolder for the GH-600 curriculum (Microsoft "Разработка в
 * агентических системах ИИ"). Generates one draft MDX per subdomain with
 * the official learningOutcomes from
 *   https://learn.microsoft.com/ru-ru/credentials/certifications/resources/study-guides/gh-600
 *
 * Theory body, flashcards, mastery quiz and practice items stay as TODO
 * placeholders — `content:check` won't block drafts on those.
 *
 * Idempotent: refuses to overwrite existing files; prints a summary at the
 * end. Run once, then fill nodes one by one.
 *
 *   pnpm tsx src/scripts/scaffold-gh600.ts
 */

import { writeFile, access, constants } from "node:fs/promises";
import path from "node:path";

const ROLE_SLUG = "agentic-ai-gh600";
const ROLE_DIR = path.join(
  process.cwd(),
  "src",
  "content",
  "roles",
  ROLE_SLUG,
);

interface NodeDef {
  slug: string;
  title: string;
  summary: string;
  estimatedMinutes: number;
  prerequisites: string[];
  learningOutcomes: string[];
}

const NODES: NodeDef[] = [
  // ----- Domain 1: Архитектура агента и SDLC --------------------------
  {
    slug: "agent-sdlc-integration",
    title: "Интеграция агентов в SDLC",
    summary:
      "Где агенты встают в жизненный цикл, какие шаги выполняют, входные/выходные данные и критерии успеха.",
    estimatedMinutes: 30,
    prerequisites: [],
    learningOutcomes: [
      "Определите шаги, которые должны выполнить агенты",
      "Определение и устранение распространенных антишаблонов в агентах",
      "Определение входных, выходных данных и критериев успешности для агентов",
    ],
  },
  {
    slug: "planning-reasoning-action",
    title: "Планирование, обоснование, действие",
    summary:
      "Разделение фазы планирования и исполнения; проверка плана и блокировка действия до утверждения.",
    estimatedMinutes: 30,
    prerequisites: ["agent-sdlc-integration"],
    learningOutcomes: [
      "Настройте планирование агента так, чтобы оно отличалось от его выполнения",
      "Настройка агента для вывода структурированного плана",
      "Проверка планов агента",
      "Запретить действие агента до его проверки и утверждения",
    ],
  },
  {
    slug: "autonomous-observability",
    title: "Наблюдаемость автономных агентов",
    summary:
      "Степень автономии, артефакты в стандартных инструментах, человеко-агентское взаимодействие без замедления.",
    estimatedMinutes: 30,
    prerequisites: ["planning-reasoning-action"],
    learningOutcomes: [
      "Планирование и реализация степени автономии агента, включая ограничения",
      "Настройка агента для создания проверяемых артефактов в стандартных инструментах разработки",
      "Конфигурация взаимодействия человека с автономными агентами без замедления доставки",
    ],
  },
  // ----- Domain 2: Инструменты и среда -------------------------------
  {
    slug: "agent-tools-selection",
    title: "Инструменты агента",
    summary: "Подбор средств агента, их настройка и управление разрешениями.",
    estimatedMinutes: 30,
    prerequisites: ["autonomous-observability"],
    learningOutcomes: [
      "Определение необходимых средств",
      "Настройка средств агента",
      "Настройка разрешений средства агента",
    ],
  },
  {
    slug: "mcp-servers",
    title: "MCP-серверы",
    summary:
      "Подключение MCP как инструмента: GitHub remote MCP, реестры, allowlists.",
    estimatedMinutes: 30,
    prerequisites: ["agent-tools-selection"],
    learningOutcomes: [
      "Добавьте сервер MCP в качестве инструмента для агента",
      "Настройка удаленного сервера MCP GitHub",
      "Настройка реестров MCP",
      "Настройка списков разрешений MCP",
    ],
  },
  {
    slug: "dev-environment-integration",
    title: "Интеграция в среды разработки",
    summary:
      "Контекст исполнения, scope по репозиторию/ветке, вызов из CI, автономные действия (ветки и PR).",
    estimatedMinutes: 30,
    prerequisites: ["mcp-servers"],
    learningOutcomes: [
      "Оцените контекст выполнения для агента",
      "Настройте область агента для определенного репозитория",
      "Настройка агента для вызова в рабочем процессе CI",
      "Настройте агента для использования области охвата на основе веток",
      "Включение агента для осуществления автономных действий, в том числе создания веток и pull-запросов",
      "Настройка агента для обработки ограничений, относящихся к среде",
    ],
  },
  {
    slug: "safe-execution-error-handling",
    title: "Безопасное выполнение и обработка ошибок",
    summary:
      "Error handling, retries, fallbacks, эскалация и трассируемость действий агента.",
    estimatedMinutes: 30,
    prerequisites: ["dev-environment-integration"],
    learningOutcomes: [
      "Реализация обработки ошибок",
      "Реализация повторных попыток",
      "Реализация откатов",
      "Реализация путей эскалации",
      "Обеспечение трассируемости и подотчетности действий агента",
    ],
  },
  // ----- Domain 3: Память, состояние, выполнение ---------------------
  {
    slug: "memory-strategies",
    title: "Стратегии памяти агента",
    summary:
      "Краткосрочная / долгосрочная / внешняя; правила истечения, обрезки и сброса.",
    estimatedMinutes: 25,
    prerequisites: ["safe-execution-error-handling"],
    learningOutcomes: [
      "Выбор между краткосрочной, долгосрочной и внешней памятью",
      "Ограничить память агента сведениями, относящимися к задачам",
      "Правила истечения срока действия памяти, обрезки и сброса",
    ],
  },
  {
    slug: "state-context-drift",
    title: "Состояние и смещение контекста",
    summary:
      "Фиксация хода задачи в артефактах, возобновление работы, обнаружение и исправление дрейфа.",
    estimatedMinutes: 30,
    prerequisites: ["memory-strategies"],
    learningOutcomes: [
      "Фиксирование хода выполнения задачи и принятия решений в виде долговременных артефактов",
      "Возобновление работы агента без повторения шагов или расхождений с предыдущими решениями",
      "Обнаружение и исправление смещения во время расширенного выполнения агента",
    ],
  },
  {
    slug: "memory-continuity",
    title: "Непрерывность памяти и состояния",
    summary:
      "Общий state между инструментами и средами; защита от устаревания и конфликтов контекста.",
    estimatedMinutes: 25,
    prerequisites: ["state-context-drift"],
    learningOutcomes: [
      "Состояние агента общего доступа",
      "Предотвращение конфликтующего контекста",
      "Предотвратить устаревание контекста",
    ],
  },
  // ----- Domain 4: Оценка, анализ ошибок, настройка ------------------
  {
    slug: "evaluation-criteria",
    title: "Критерии успешности и сигналы оценки",
    summary:
      "Ожидаемые результаты и ограничения задачи; качественные и количественные сигналы; автоматические сканы как источник сигналов.",
    estimatedMinutes: 30,
    prerequisites: ["memory-continuity"],
    learningOutcomes: [
      "Указание ожидаемых результатов и операционных ограничений для задач агента",
      "Определение качественных и количественных сигналов оценки для оценки агентов",
      "Согласование критериев оценки с целями разработки",
      "Создание сигналов оценки с помощью средств автоматического сканирования",
    ],
  },
  {
    slug: "failure-analysis",
    title: "Анализ сбоев агента",
    summary:
      "Логи, планы, трассировки, артефакты рабочих процессов; классификация первопричин: рассуждение, инструменты, контекст.",
    estimatedMinutes: 30,
    prerequisites: ["evaluation-criteria"],
    learningOutcomes: [
      "Выявление сбоев с помощью журналов, планов, трассировок, выходных данных и артефактов рабочих процессов",
      "Классифицируйте первопричины, включая ошибки в рассуждениях, неправильное использование инструментов и вопросы, связанные с контекстом или средой",
    ],
  },
  {
    slug: "behavior-tuning",
    title: "Настройка поведения агента",
    summary:
      "Тонкая настройка инструкций, рабочих процессов, ограничений; уточнение памяти и доступа к инструментам.",
    estimatedMinutes: 25,
    prerequisites: ["failure-analysis"],
    learningOutcomes: [
      "Изменение инструкций, рабочих процессов или ограничений",
      "Уточнение использования памяти",
      "Уточнение использования инструментов и доступа к инструментам",
    ],
  },
  // ----- Domain 5: Многоагентная координация -------------------------
  {
    slug: "multi-agent-orchestration",
    title: "Оркестрация многоагентных систем",
    summary:
      "Шаблоны оркестрации, изоляция параллельных агентов, разрешение конфликтов изменений и противоречивых выходов.",
    estimatedMinutes: 35,
    prerequisites: ["behavior-tuning"],
    learningOutcomes: [
      "Применение шаблона оркестрации для координации нескольких агентов",
      "Настройка изоляции агента для параллельного выполнения",
      "Обнаружение и разрешение конфликтов агентов, включая перекрывающиеся изменения кода, повторяющиеся усилия и противоречивые выходные данные",
    ],
  },
  {
    slug: "multi-agent-observability",
    title: "Наблюдаемость многоагентных систем",
    summary:
      "Артефакты, пригодные для аудита, документирование решений и передач, постфактум анализ поведения.",
    estimatedMinutes: 30,
    prerequisites: ["multi-agent-orchestration"],
    learningOutcomes: [
      "Настройка рабочих процессов с несколькими агентами для создания артефактов, подходящих для проверки и аудита",
      "Документируйте ключевые решения, передачи и результаты между агентами",
      "Проведите пост-фактум анализ поведения многоагентной системы",
    ],
  },
  {
    slug: "multi-agent-failures",
    title: "Отказы в многоагентных системах",
    summary:
      "Выявление неудачных и приостановленных исполнений; реакция на ухудшение; recovery-шаблоны и human-in-the-loop.",
    estimatedMinutes: 30,
    prerequisites: ["multi-agent-observability"],
    learningOutcomes: [
      "Выявление неудачных, частичных или приостановленных исполнений агента",
      "Реагировать на ухудшенное поведение или координацию действий агентов",
      "Реализация шаблонов восстановления с несколькими агентами, включая откат и участие человека в процессе",
    ],
  },
  {
    slug: "multi-agent-lifecycle",
    title: "Жизненный цикл многоагентных процессов",
    summary:
      "Добавление, обновление и вывод агентов без нарушения активных рабочих процессов; сохранение аудируемости.",
    estimatedMinutes: 25,
    prerequisites: ["multi-agent-failures"],
    learningOutcomes: [
      "Добавление агентов в существующие рабочие процессы с несколькими агентами",
      "Обновление, перенастройка или замена агентов без нарушения активных рабочих процессов",
      "Вывод агентов из эксплуатации с сохранением аудируемости и непрерывности рабочих процессов",
    ],
  },
  // ----- Domain 6: Ограничители и подотчетность ----------------------
  {
    slug: "autonomy-levels",
    title: "Уровни автономии",
    summary:
      "Классификация действий по риску; назначение уровней автономии для скорости + безопасности.",
    estimatedMinutes: 25,
    prerequisites: ["multi-agent-lifecycle"],
    learningOutcomes: [
      "Классификация действий агентов по операционным рискам, рискам безопасности и рискам соответствия для оптимизации человеческого вмешательства",
      "Назначение уровней автономии для максимальной скорости доставки при сохранении соответствия стандартам безопасности организации и ответственного искусственного интеллекта",
    ],
  },
  {
    slug: "guardrails-human-in-loop",
    title: "Ограничители и human-in-the-loop",
    summary:
      "Действия с обязательным одобрением; блокировка нарушений политик; принцип минимальных прав; контроль необратимых изменений.",
    estimatedMinutes: 30,
    prerequisites: ["autonomy-levels"],
    learningOutcomes: [
      "Определение подмножества действий, требующих человеческого решения",
      "Блокировать действия, которые нарушают определенные политики безопасности, соответствия или ответственного ИИ",
      "Ограничение разрешений и контекстов выполнения для обеспечения минимально необходимого доступа",
      "Требовать явную авторизацию или контролируемые пути для необратимых или чувствительных к соблюдению норм изменений",
      "Поддержание скорости выполнения за счет уменьшения количества согласований, которые незначительно снижают риск",
    ],
  },
];

function mdxTemplate(node: NodeDef): string {
  const prereqYaml =
    node.prerequisites.length === 0
      ? "prerequisites: []"
      : `prerequisites:\n${node.prerequisites.map((p) => `  - ${p}`).join("\n")}`;

  const outcomes = node.learningOutcomes
    .map((o) => `  - ${JSON.stringify(o)}`)
    .join("\n");

  const flashcards = Array.from(
    { length: 6 },
    (_, i) =>
      `  - front: "TODO front #${i + 1}"\n    back: "TODO back #${i + 1}"`,
  ).join("\n");

  const masteryQuiz = Array.from(
    { length: 5 },
    (_, i) =>
      `  - kind: mcq
    prompt: "TODO mastery prompt #${i + 1}"
    options:
      - TODO option 1
      - TODO option 2
      - TODO option 3
      - TODO option 4
    answerIndex: 0
    explanation: "TODO: объяснение."`,
  ).join("\n");

  return `---
schemaVersion: 1
slug: ${node.slug}
title: ${JSON.stringify(node.title)}
summary: ${JSON.stringify(node.summary)}
status: draft
estimatedMinutes: ${node.estimatedMinutes}
${prereqYaml}
learningOutcomes:
${outcomes}
practice:
  - kind: mcq
    prompt: "TODO: один MCQ, проверяющий ключевую идею узла."
    options:
      - TODO option 1
      - TODO option 2
      - TODO option 3
      - TODO option 4
    answerIndex: 0
    explanation: "TODO: 1-2 предложения объяснения."
flashcards:
${flashcards}
masteryQuiz:
${masteryQuiz}
---

## TODO: контекст и зачем это важно

Короткий ментальный крючок — почему эта тема важна для агентов в SDLC и
что без неё ломается на практике.

## TODO: ключевые идеи

Объясните центральные понятия с привязкой к учебным целям выше. Списки и
таблицы, где они помогают мысли.

## TODO: типичные ошибки и паттерны

1–2 примера того, как обычно ошибаются, и как делать правильно.

## Попробуйте

Конкретное действие, которое учащийся может выполнить сразу (репозиторий,
workflow, конфиг — что угодно осязаемое).
`;
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(ROLE_DIR))) {
    throw new Error(
      `Role directory missing: ${ROLE_DIR}\n` +
        `Run pnpm db:seed first so the role is in the DB; then create the dir manually with: mkdir -p "${ROLE_DIR}"`,
    );
  }

  let created = 0;
  let skipped = 0;
  for (const node of NODES) {
    const filePath = path.join(ROLE_DIR, `${node.slug}.mdx`);
    if (await exists(filePath)) {
      console.log(`· skip ${node.slug} (already exists)`);
      skipped++;
      continue;
    }
    await writeFile(filePath, mdxTemplate(node), "utf8");
    console.log(`✓ ${node.slug}`);
    created++;
  }

  console.log("");
  console.log(`Done: ${created} created, ${skipped} skipped.`);
  if (created > 0) {
    console.log("Next:");
    console.log("  pnpm content:check      # validate drafts");
    console.log("  pnpm db:seed            # sync flashcards into skill_cards");
  }
}

main().catch((err) => {
  console.error("scaffold-gh600 failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
