"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  nodePrerequisites,
  nodes as nodesTable,
  roles as rolesTable,
  userNodeProgress,
} from "@/db/schema";
import { DEMO_MODE } from "@/lib/auth/demo-mode";
import {
  logEvent,
  maybeFlipMastered,
  upsertProgress,
} from "@/lib/progress/transitions";
import { ContentNotFoundError, loadNode } from "@/lib/content/loader";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ServerActionInputs = {
  markTheoryRead: z.object({
    roleSlug: z.string().regex(/^[a-z0-9-]+$/),
    nodeSlug: z.string().regex(/^[a-z0-9-]+$/),
  }),
  gradePracticeMcq: z.object({
    roleSlug: z.string().regex(/^[a-z0-9-]+$/),
    nodeSlug: z.string().regex(/^[a-z0-9-]+$/),
    itemKey: z.string().min(1),
    chosenIndex: z.number().int().nonnegative(),
  }),
  submitMasteryQuiz: z.object({
    roleSlug: z.string().regex(/^[a-z0-9-]+$/),
    nodeSlug: z.string().regex(/^[a-z0-9-]+$/),
    /** Ответы пользователя: индекс вопроса в ОРИГИНАЛЬНОМ массиве frontmatter. */
    answers: z.array(
      z.object({
        questionIndex: z.number().int().nonnegative(),
        chosenIndex: z.number().int().nonnegative(),
      }),
    ),
  }),
} as const;

/** Pass threshold for the mastery quiz — 4 of 5, per ROADMAP. */
const MASTERY_PASS_RATIO = 0.8;

// ---------------------------------------------------------------------------
// Вспомогательные функции
// ---------------------------------------------------------------------------

/**
 * Возвращает user + node для авторизованных, либо `null` для гостей в
 * DEMO_MODE. Без DEMO_MODE гость по-прежнему получает Not authenticated —
 * это «жёсткий» путь для реальных пользователей.
 *
 * Fix #3: разрешаем узел по roleId + slug (а не только по slug), чтобы
 * избежать коллизии при одинаковых slug в разных ролях.
 */
async function resolveUserAndNode(input: {
  roleSlug: string;
  nodeSlug: string;
}): Promise<{ userId: string; nodeId: string } | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    if (DEMO_MODE) return null;
    throw new Error("Not authenticated");
  }

  // Сначала роль, потом узел — UNIQUE(role_id, slug) в DB.
  const role = await db
    .select({ id: rolesTable.id })
    .from(rolesTable)
    .where(eq(rolesTable.slug, input.roleSlug))
    .limit(1)
    .then((r) => r[0]);
  if (!role) throw new Error(`Unknown role slug: ${input.roleSlug}`);

  const node = await db
    .select({ id: nodesTable.id })
    .from(nodesTable)
    .where(
      and(eq(nodesTable.roleId, role.id), eq(nodesTable.slug, input.nodeSlug)),
    )
    .limit(1)
    .then((r) => r[0]);
  if (!node) throw new Error(`Unknown node slug: ${input.nodeSlug}`);

  return { userId: user.id, nodeId: node.id };
}

/**
 * Fix #6: заменяем N+1-цикл одним запросом с inArray + count.
 */
async function arePrereqsSatisfied(
  userId: string,
  nodeId: string,
): Promise<boolean> {
  const prereqs = await db
    .select({ prerequisiteNodeId: nodePrerequisites.prerequisiteNodeId })
    .from(nodePrerequisites)
    .where(eq(nodePrerequisites.nodeId, nodeId));
  if (prereqs.length === 0) return true;

  const prereqIds = prereqs.map((p) => p.prerequisiteNodeId);

  const masteredCount = await db
    .select({ n: count() })
    .from(userNodeProgress)
    .where(
      and(
        eq(userNodeProgress.userId, userId),
        inArray(userNodeProgress.nodeId, prereqIds),
        eq(userNodeProgress.status, "mastered"),
      ),
    )
    .then((r) => r[0]?.n ?? 0);

  return masteredCount === prereqIds.length;
}

// ---------------------------------------------------------------------------
// Server actions
// ---------------------------------------------------------------------------

const RecordPracticeCorrectInput = z.object({
  roleSlug: z.string().regex(/^[a-z0-9-]+$/),
  nodeSlug: z.string().regex(/^[a-z0-9-]+$/),
  itemKey: z.string().min(1),
});

/**
 * Совместимый экспорт для code-exercise.tsx (code-упражнения не требуют
 * серверной проверки — Sandpack сам запускает тесты). Логирует событие
 * practice_correct для авторизованных пользователей.
 */
export async function recordPracticeCorrect(
  raw: z.input<typeof RecordPracticeCorrectInput>,
) {
  const input = RecordPracticeCorrectInput.parse(raw);
  const ctx = await resolveUserAndNode(input);
  if (!ctx) return; // гость в demo: client отрисовал «правильно», нам нечего логировать
  await logEvent(ctx.userId, "practice_correct", "node", ctx.nodeId, {
    itemKey: input.itemKey,
  });
}

export async function markTheoryRead(
  raw: z.input<typeof ServerActionInputs.markTheoryRead>,
) {
  const input = ServerActionInputs.markTheoryRead.parse(raw);
  const ctx = await resolveUserAndNode(input);
  // Гость в DEMO_MODE: client-side `setRead(true)` уже произошёл, нам
  // нечего писать. Просто молча возвращаемся.
  if (!ctx) return;

  if (!(await arePrereqsSatisfied(ctx.userId, ctx.nodeId))) {
    throw new Error("Cannot start a node whose prerequisites aren't mastered.");
  }

  const current = await db
    .select({ status: userNodeProgress.status })
    .from(userNodeProgress)
    .where(
      and(
        eq(userNodeProgress.userId, ctx.userId),
        eq(userNodeProgress.nodeId, ctx.nodeId),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  // Only flip locked -> in_progress; in_progress / mastered are unchanged.
  if (current?.status !== "in_progress" && current?.status !== "mastered") {
    await upsertProgress(ctx.userId, ctx.nodeId, {
      status: "in_progress",
      startedAt: new Date(),
    });
  }

  await logEvent(ctx.userId, "theory_read", "node", ctx.nodeId);
  revalidatePath(`/roles/${input.roleSlug}/nodes/${input.nodeSlug}`);
  revalidatePath(`/roles/${input.roleSlug}`);
}

export interface GradePracticeMcqResult {
  correct: boolean;
  correctIndex: number;
  explanation: string;
}

/**
 * Fix #1 — серверная проверка MCQ.
 * Принимает chosenIndex, загружает правильный ответ из MDX-фронтматтера,
 * возвращает {correct, correctIndex, explanation}. Логирует событие только
 * при правильном ответе. Гостям в DEMO_MODE возвращает результат без записи
 * в БД.
 */
export async function gradePracticeMcq(
  raw: z.input<typeof ServerActionInputs.gradePracticeMcq>,
): Promise<GradePracticeMcqResult> {
  const input = ServerActionInputs.gradePracticeMcq.parse(raw);

  // Загружаем фронтматтер на сервере — клиент его не получает.
  let loaded;
  try {
    loaded = await loadNode(input.roleSlug, input.nodeSlug);
  } catch (err) {
    if (err instanceof ContentNotFoundError) {
      throw new Error(`Node not found: ${input.nodeSlug}`);
    }
    throw err;
  }

  // itemKey имеет вид "mcq:N"
  const match = /^mcq:(\d+)$/.exec(input.itemKey);
  if (!match) throw new Error(`Invalid itemKey: ${input.itemKey}`);
  const idx = parseInt(match[1]!, 10);

  const mcqItems = loaded.frontmatter.practice.filter((p) => p.kind === "mcq");
  const item = mcqItems[idx];
  if (!item) throw new Error(`MCQ item ${idx} not found`);

  const correct = input.chosenIndex === item.answerIndex;

  const ctx = await resolveUserAndNode(input);
  // Гост в demo: результат возвращаем, в БД не пишем.
  if (ctx && correct) {
    await logEvent(ctx.userId, "practice_correct", "node", ctx.nodeId, {
      itemKey: input.itemKey,
    });
  }

  return {
    correct,
    correctIndex: item.answerIndex,
    explanation: item.explanation,
  };
}

export interface MasteryQuizResult {
  passed: boolean;
  mastered: boolean;
  score: number;
  total: number;
  /** Детали по каждому вопросу для отображения разбора. */
  details: Array<{
    questionIndex: number;
    correct: boolean;
    correctIndex: number;
    explanation: string;
  }>;
}

/**
 * Fix #1 — серверная проверка mastery quiz + Fix #5 (транзакция).
 * Принимает ответы с ОРИГИНАЛЬНЫМИ индексами вопросов (до перемешивания),
 * самостоятельно считает score/total — клиентскому значению не доверяем.
 * Гостям в DEMO_MODE возвращает результат без записи в БД.
 */
export async function submitMasteryQuiz(
  raw: z.input<typeof ServerActionInputs.submitMasteryQuiz>,
): Promise<MasteryQuizResult> {
  const input = ServerActionInputs.submitMasteryQuiz.parse(raw);

  // Загружаем правильные ответы на сервере.
  let loaded;
  try {
    loaded = await loadNode(input.roleSlug, input.nodeSlug);
  } catch (err) {
    if (err instanceof ContentNotFoundError) {
      throw new Error(`Node not found: ${input.nodeSlug}`);
    }
    throw err;
  }

  const pool = loaded.frontmatter.masteryQuiz;
  const total = input.answers.length;
  if (total === 0) throw new Error("No answers provided");

  // Вычисляем результаты — сервер является единственным источником истины.
  const details = input.answers.map((a) => {
    const q = pool[a.questionIndex];
    if (!q) throw new Error(`Invalid questionIndex: ${a.questionIndex}`);
    return {
      questionIndex: a.questionIndex,
      correct: a.chosenIndex === q.answerIndex,
      correctIndex: q.answerIndex,
      explanation: q.explanation,
    };
  });

  const score = details.filter((d) => d.correct).length;
  const ratio = score / total;
  const passed = ratio >= MASTERY_PASS_RATIO;

  const ctx = await resolveUserAndNode(input);
  // Гость в demo: возвращаем результат без записи в БД.
  if (!ctx) {
    return { passed, mastered: false, score, total, details };
  }

  // Fix #5: три записи в одной транзакции.
  let mastered = false;
  await db.transaction(async (tx) => {
    await logEvent(
      ctx.userId,
      passed ? "mastery_passed" : "mastery_failed",
      "node",
      ctx.nodeId,
      { score, total, ratio },
      tx,
    );

    if (passed) {
      await upsertProgress(
        ctx.userId,
        ctx.nodeId,
        { status: "in_progress", masteryScore: ratio },
        tx,
      );
      mastered = await maybeFlipMastered(ctx.userId, ctx.nodeId, tx);
    }
  });

  revalidatePath(`/roles/${input.roleSlug}/nodes/${input.nodeSlug}`);
  revalidatePath(`/roles/${input.roleSlug}`);

  return { passed, mastered, score, total, details };
}
