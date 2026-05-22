"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  nodePrerequisites,
  nodes as nodesTable,
  userNodeProgress,
} from "@/db/schema";
import { DEMO_MODE } from "@/lib/auth/demo-mode";
import {
  logEvent,
  maybeFlipMastered,
  upsertProgress,
} from "@/lib/progress/transitions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ServerActionInputs = {
  markTheoryRead: z.object({
    roleSlug: z.string().regex(/^[a-z0-9-]+$/),
    nodeSlug: z.string().regex(/^[a-z0-9-]+$/),
  }),
  recordPracticeCorrect: z.object({
    roleSlug: z.string().regex(/^[a-z0-9-]+$/),
    nodeSlug: z.string().regex(/^[a-z0-9-]+$/),
    itemKey: z.string().min(1),
  }),
  submitMasteryQuiz: z.object({
    roleSlug: z.string().regex(/^[a-z0-9-]+$/),
    nodeSlug: z.string().regex(/^[a-z0-9-]+$/),
    score: z.number().int().nonnegative(),
    total: z.number().int().positive(),
  }),
} as const;

/** Pass threshold for the mastery quiz — 4 of 5, per ROADMAP. */
const MASTERY_PASS_RATIO = 0.8;

/**
 * Возвращает user + node для авторизованных, либо `null` для гостей в
 * DEMO_MODE. Без DEMO_MODE гость по-прежнему получает Not authenticated —
 * это «жёсткий» путь для реальных пользователей.
 *
 * Действия используют возвращаемый null как сигнал «выполни client-side
 * UX, ничего не пиши в БД». Это позволяет гостю в demo пройти MCQ или
 * mastery-quiz, увидеть verdict, но не оставить следов прогресса.
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

  const node = await db
    .select({ id: nodesTable.id })
    .from(nodesTable)
    .where(eq(nodesTable.slug, input.nodeSlug))
    .limit(1)
    .then((r) => r[0]);
  if (!node) throw new Error(`Unknown node slug: ${input.nodeSlug}`);

  return { userId: user.id, nodeId: node.id };
}

async function arePrereqsSatisfied(
  userId: string,
  nodeId: string,
): Promise<boolean> {
  const prereqs = await db
    .select({ prerequisiteNodeId: nodePrerequisites.prerequisiteNodeId })
    .from(nodePrerequisites)
    .where(eq(nodePrerequisites.nodeId, nodeId));
  if (prereqs.length === 0) return true;

  for (const p of prereqs) {
    const row = await db
      .select({ status: userNodeProgress.status })
      .from(userNodeProgress)
      .where(
        and(
          eq(userNodeProgress.userId, userId),
          eq(userNodeProgress.nodeId, p.prerequisiteNodeId),
        ),
      )
      .limit(1)
      .then((r) => r[0]);
    if (row?.status !== "mastered") return false;
  }
  return true;
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

export async function recordPracticeCorrect(
  raw: z.input<typeof ServerActionInputs.recordPracticeCorrect>,
) {
  const input = ServerActionInputs.recordPracticeCorrect.parse(raw);
  const ctx = await resolveUserAndNode(input);
  if (!ctx) return; // гость в demo: client отрисовал «правильно», нам нечего логировать
  await logEvent(ctx.userId, "practice_correct", "node", ctx.nodeId, {
    itemKey: input.itemKey,
  });
}

export async function submitMasteryQuiz(
  raw: z.input<typeof ServerActionInputs.submitMasteryQuiz>,
) {
  const input = ServerActionInputs.submitMasteryQuiz.parse(raw);
  const ratio = input.score / input.total;
  const passed = ratio >= MASTERY_PASS_RATIO;

  const ctx = await resolveUserAndNode(input);
  // Гость в demo: возвращаем тот же result-shape, что и для авторизованного,
  // но `mastered` всегда false (нет userNodeProgress). UI у MasteryQuiz
  // зовёт `onPassed()` по флагу `passed`, и тут он корректный.
  if (!ctx) {
    return { passed, mastered: false, score: input.score };
  }

  await logEvent(
    ctx.userId,
    passed ? "mastery_passed" : "mastery_failed",
    "node",
    ctx.nodeId,
    { score: input.score, total: input.total, ratio },
  );

  if (passed) {
    await upsertProgress(ctx.userId, ctx.nodeId, {
      status: "in_progress",
      masteryScore: ratio,
    });
    const flipped = await maybeFlipMastered(ctx.userId, ctx.nodeId);
    revalidatePath(`/roles/${input.roleSlug}/nodes/${input.nodeSlug}`);
    revalidatePath(`/roles/${input.roleSlug}`);
    return { passed: true, mastered: flipped, score: input.score };
  }

  return { passed: false, mastered: false, score: input.score };
}
