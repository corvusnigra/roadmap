"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  conceptExplanations,
  nodes as nodesTable,
  roles as rolesTable,
} from "@/db/schema";
import { generateTutorReply } from "@/lib/ai/anthropic";
import { TUTOR_SYSTEM_PROMPT_VERSION } from "@/lib/ai/prompts";
import {
  packChunksForPrompt,
  retrieveContext,
} from "@/lib/rag/retrieve";

/**
 * Inline-tutor: «что значит X в контексте этого узла?». В отличие от
 * полноценного диалога (sendTutorMessage) — здесь нет истории, нет
 * persistence per-user, нет rate-limit на пользователя. Запрашивает
 * объяснение один раз, кэширует общий результат в `concept_explanations`
 * по (nodeId, normalized concept). Повторный клик по тому же выражению
 * (в том же узле, любым пользователем, в т.ч. гостем) выдаёт мгновенный
 * cached response.
 *
 * Почему кэш общий, а не per-user: объяснение «что такое замыкание»
 * в узле «Closures» одинаково для всех. Per-user persistence — это
 * полноценный диалог, для которого есть отдельный action.
 *
 * Concurrency: при гонке двух одновременных INSERT'ов один упрётся в
 * UNIQUE(node_id, concept) и мы пере-выберем существующую строку.
 * Дубликата LLM-запроса при этом избежать сложно (race window), но
 * это акцептабельно — счёт идёт на разовые попадания, не на load.
 */

const ExplainInput = z.object({
  roleSlug: z.string().regex(/^[a-z0-9-]+$/),
  nodeSlug: z.string().regex(/^[a-z0-9-]+$/),
  // Выделение из текста статьи. Жёсткие границы как у sendTutorMessage'а
  // защищают от мусора («один пробел») и от попыток засунуть в кэш
  // целые абзацы (это уже не понятие, а ad-hoc вопрос).
  concept: z.string().min(2).max(200),
});

export interface ExplainConceptResult {
  /** Markdown-объяснение для отображения. */
  explanation: string;
  /** true → ответ из кэша, false → свежий LLM-вызов. Полезно для UX (бейдж). */
  cached: boolean;
  /** Нормализованная форма — UI может показать её в шапке поповера. */
  conceptNormalized: string;
  /** То, что выделил пользователь. */
  conceptOriginal: string;
}

/**
 * Сжимает любые подряд идущие whitespace-символы (пробел, таб, перевод
 * строки, NBSP) в один пробел и приводит к lowercase. Так два запроса
 * «  Закрытие  » и «закрытие» попадают в один ключ кэша.
 */
function normalizeConcept(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().toLowerCase();
}

const MAX_CONTEXT_CHARS = 12_000; // короче чем полный tutor — нам нужен один абзац

export async function explainConcept(
  raw: z.input<typeof ExplainInput>,
): Promise<ExplainConceptResult> {
  const input = ExplainInput.parse(raw);
  const original = input.concept.trim();
  const normalized = normalizeConcept(original);

  // 1. Сначала находим узел: нужен node.id для join'а кэша. Также
  //    валидирует, что (role, node) реально существуют — иначе клиент
  //    может попытаться отравить кэш чужим nodeId.
  const role = await db
    .select({ id: rolesTable.id })
    .from(rolesTable)
    .where(eq(rolesTable.slug, input.roleSlug))
    .limit(1)
    .then((r) => r[0]);
  if (!role) throw new Error(`Unknown role: ${input.roleSlug}`);

  const node = await db
    .select({ id: nodesTable.id, roleId: nodesTable.roleId })
    .from(nodesTable)
    .where(
      and(
        eq(nodesTable.roleId, role.id),
        eq(nodesTable.slug, input.nodeSlug),
      ),
    )
    .limit(1)
    .then((r) => r[0]);
  if (!node) throw new Error(`Unknown node: ${input.nodeSlug}`);

  // 2. Cache lookup. UNIQUE(nodeId, concept) гарантирует ≤1 строки.
  const cached = await db
    .select({
      explanation: conceptExplanations.explanation,
      conceptOriginal: conceptExplanations.conceptOriginal,
    })
    .from(conceptExplanations)
    .where(
      and(
        eq(conceptExplanations.nodeId, node.id),
        eq(conceptExplanations.concept, normalized),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  if (cached) {
    return {
      explanation: cached.explanation,
      cached: true,
      conceptNormalized: normalized,
      conceptOriginal: cached.conceptOriginal,
    };
  }

  // 3. Miss → RAG + LLM. Используем тот же retrieveContext, что и
  //    основной tutor: текущий узел + транзитивные prereq'и.
  const ctx = await retrieveContext(input.roleSlug, input.nodeSlug);
  const contextBlock = packChunksForPrompt(ctx.chunks, MAX_CONTEXT_CHARS);

  // Свой системный промпт — короче и без soкратической логики, мы
  // явно просим определение, а не диалог.
  const systemPrompt = [
    "Вы — наставник RoleRoadmap. Объясняйте кратко (≤120 слов), на русском.",
    "Используйте ТОЛЬКО блок <context> ниже. Если выражения нет в контексте — ответьте дословно: \"Это понятие не раскрыто в текущем узле.\"",
    "Не выдумывайте API, библиотеки или код, которых нет в контексте дословно.",
    "Формат: одно-два коротких предложения определения + (опционально) одно предложение пример. Markdown без заголовков.",
    "",
    "<context>",
    contextBlock,
    "</context>",
  ].join("\n");

  const reply = await generateTutorReply({
    systemPrompt,
    history: [],
    userMessage: `Объясни кратко: «${original}»`,
  });

  // 4. Persist. ON CONFLICT не нужен — UNIQUE + race-fallback: если
  //    кто-то опередил, нашу строку отбракует, читаем существующую.
  try {
    const [row] = await db
      .insert(conceptExplanations)
      .values({
        nodeId: node.id,
        concept: normalized,
        conceptOriginal: original,
        explanation: reply.text,
        modelId: `${reply.model}@prompt-v${TUTOR_SYSTEM_PROMPT_VERSION}`,
      })
      .returning();

    return {
      explanation: row?.explanation ?? reply.text,
      cached: false,
      conceptNormalized: normalized,
      conceptOriginal: original,
    };
  } catch (err) {
    // Race: другой запрос вставил тот же ключ. Пере-выбираем.
    const racewinner = await db
      .select({
        explanation: conceptExplanations.explanation,
        conceptOriginal: conceptExplanations.conceptOriginal,
      })
      .from(conceptExplanations)
      .where(
        and(
          eq(conceptExplanations.nodeId, node.id),
          eq(conceptExplanations.concept, normalized),
        ),
      )
      .limit(1)
      .then((r) => r[0]);
    if (racewinner) {
      return {
        explanation: racewinner.explanation,
        cached: true,
        conceptNormalized: normalized,
        conceptOriginal: racewinner.conceptOriginal,
      };
    }
    // Это не race — какая-то другая ошибка. Пробрасываем.
    throw err;
  }
}
