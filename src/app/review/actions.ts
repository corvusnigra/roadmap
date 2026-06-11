"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  nodes as nodesTable,
  roles as rolesTable,
  skillCards,
  userCardState,
  userNodeProgress,
} from "@/db/schema";
import { DEMO_MODE } from "@/lib/auth/demo-mode";
import { reviewCard, type CardStateRow } from "@/lib/fsrs/scheduler";
import { logEvent, maybeFlipMastered } from "@/lib/progress/transitions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const GradeCardInput = z.object({
  cardId: z.string().uuid(),
  rating: z.number().int().min(1).max(4),
});

export interface GradeCardResult {
  nextDueAt: string;
  mastered: boolean;
  state: CardStateRow["state"];
}

export async function gradeCard(
  raw: z.input<typeof GradeCardInput>,
): Promise<GradeCardResult> {
  const input = GradeCardInput.parse(raw);
  const rating = input.rating as 1 | 2 | 3 | 4;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    if (DEMO_MODE) {
      // Гость в demo: возвращаем «локально посчитанный» next due, не пишем
      // ничего в БД. UI отрисует «next ETA» из этого ответа, и всё.
      const nextDue = new Date(Date.now() + 24 * 60 * 60 * 1000);
      return {
        nextDueAt: nextDue.toISOString(),
        mastered: false,
        state: "new" as CardStateRow["state"],
      };
    }
    throw new Error("Not authenticated");
  }

  // Look the card up — we need its node (for state-machine transitions) and
  // role (for revalidation).
  const card = await db
    .select({
      nodeId: skillCards.nodeId,
      nodeSlug: nodesTable.slug,
      roleSlug: rolesTable.slug,
    })
    .from(skillCards)
    .innerJoin(nodesTable, eq(nodesTable.id, skillCards.nodeId))
    .innerJoin(rolesTable, eq(rolesTable.id, nodesTable.roleId))
    .where(eq(skillCards.id, input.cardId))
    .limit(1)
    .then((rows) => rows[0]);
  if (!card) throw new Error(`Unknown card: ${input.cardId}`);

  // Fix #4: карточку можно оценивать только если узел начат или освоен
  // данным пользователем — такая же проверка, как в getDueCards.
  const nodeProgress = await db
    .select({ status: userNodeProgress.status })
    .from(userNodeProgress)
    .where(
      and(
        eq(userNodeProgress.userId, user.id),
        eq(userNodeProgress.nodeId, card.nodeId),
        inArray(userNodeProgress.status, ["in_progress", "mastered"] as const),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);
  if (!nodeProgress) {
    throw new Error(
      "Cannot grade a card for a node that is not in progress or mastered.",
    );
  }

  const prev = await db
    .select({
      stability: userCardState.stability,
      difficulty: userCardState.difficulty,
      dueAt: userCardState.dueAt,
      reps: userCardState.reps,
      lapses: userCardState.lapses,
      lastReviewAt: userCardState.lastReviewAt,
      state: userCardState.state,
    })
    .from(userCardState)
    .where(
      and(
        eq(userCardState.userId, user.id),
        eq(userCardState.cardId, input.cardId),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  const now = new Date();
  const next = reviewCard(prev, rating, now);

  // Fix #5: три записи в одной транзакции.
  let mastered = false;
  await db.transaction(async (tx) => {
    await tx
      .insert(userCardState)
      .values({
        userId: user.id,
        cardId: input.cardId,
        stability: next.stability,
        difficulty: next.difficulty,
        dueAt: next.dueAt,
        reps: next.reps,
        lapses: next.lapses,
        lastReviewAt: next.lastReviewAt,
        state: next.state,
      })
      .onConflictDoUpdate({
        target: [userCardState.userId, userCardState.cardId],
        set: {
          stability: next.stability,
          difficulty: next.difficulty,
          dueAt: next.dueAt,
          reps: next.reps,
          lapses: next.lapses,
          lastReviewAt: next.lastReviewAt,
          state: next.state,
        },
      });

    await logEvent(
      user.id,
      "card_reviewed",
      "node",
      card.nodeId,
      {
        cardId: input.cardId,
        rating,
        dueAt: next.dueAt.toISOString(),
        state: next.state,
      },
      tx,
    );

    mastered = await maybeFlipMastered(user.id, card.nodeId, tx);
  });

  revalidatePath("/review");
  revalidatePath(`/roles/${card.roleSlug}`);
  revalidatePath(`/roles/${card.roleSlug}/nodes/${card.nodeSlug}`);

  return {
    nextDueAt: next.dueAt.toISOString(),
    mastered,
    state: next.state,
  };
}
