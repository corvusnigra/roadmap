import "server-only";

import { and, count, eq } from "drizzle-orm";

import { db, type Database } from "@/lib/db";
import {
  skillCards,
  userCardState,
  userEvents,
  userNodeProgress,
  type NewUserNodeProgress,
} from "@/db/schema";
import { captureEvent } from "@/lib/analytics/posthog";
import { decideMastery, type CardRecallInfo } from "@/lib/progress-core";

// Drizzle transaction handle — same shape as `db` itself.
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DbOrTx = Database | Tx;

/**
 * Insert a userEvents row. Verb naming is consistent across the codebase —
 * `theory_read`, `practice_correct`, `mastery_passed`, `mastery_failed`,
 * `card_reviewed`.
 */
export async function logEvent(
  userId: string,
  verb: string,
  objectType: string,
  objectId: string,
  payload: Record<string, unknown> = {},
  dbHandle: DbOrTx = db,
): Promise<void> {
  await dbHandle.insert(userEvents).values({
    userId,
    verb,
    objectType,
    objectId,
    payload,
  });
  // Fire-and-forget mirror to PostHog. The wrapper is a no-op when the
  // public key is the placeholder, so local dev doesn't network-call out.
  captureEvent(userId, verb, { objectType, objectId, ...payload });
}

/** Upsert into user_node_progress with the timestamp set to now. */
export async function upsertProgress(
  userId: string,
  nodeId: string,
  patch: Partial<NewUserNodeProgress>,
  dbHandle: DbOrTx = db,
): Promise<void> {
  await dbHandle
    .insert(userNodeProgress)
    .values({
      userId,
      nodeId,
      status: patch.status ?? "in_progress",
      startedAt: patch.startedAt,
      masteryScore: patch.masteryScore,
      masteredAt: patch.masteredAt,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [userNodeProgress.userId, userNodeProgress.nodeId],
      set: { ...patch, updatedAt: new Date() },
    });
}

/**
 * Загружает состояния всех карточек узла, нужные для подсчёта retrievability.
 * Карточки без строки в userCardState возвращаются как {stability:null, lastReviewAt:null}.
 */
async function loadCardRecallInfos(
  userId: string,
  nodeId: string,
  dbHandle: DbOrTx = db,
): Promise<CardRecallInfo[]> {
  const rows = await dbHandle
    .select({
      cardId: skillCards.id,
      stability: userCardState.stability,
      lastReviewAt: userCardState.lastReviewAt,
    })
    .from(skillCards)
    .leftJoin(
      userCardState,
      and(
        eq(userCardState.cardId, skillCards.id),
        eq(userCardState.userId, userId),
      ),
    )
    .where(eq(skillCards.nodeId, nodeId));

  return rows.map((r) => ({
    stability: r.stability ?? null,
    lastReviewAt: r.lastReviewAt ?? null,
  }));
}

/**
 * Проверяет, сдан ли итоговый тест (есть ли хотя бы одна запись mastery_passed).
 */
async function hasMasteryPassed(
  userId: string,
  nodeId: string,
  dbHandle: DbOrTx = db,
): Promise<boolean> {
  const row = await dbHandle
    .select({ n: count() })
    .from(userEvents)
    .where(
      and(
        eq(userEvents.userId, userId),
        eq(userEvents.verb, "mastery_passed"),
        eq(userEvents.objectId, nodeId),
      ),
    );
  return (row[0]?.n ?? 0) > 0;
}

/**
 * Promote a node to `mastered` iff:
 *  1. User has at least one mastery_passed event for the node.
 *  2. All cards of the node have been reviewed at least once.
 *  3. Min FSRS retrievability across all cards ≥ 0.85.
 *
 * Returns true if the row flipped.
 */
export async function maybeFlipMastered(
  userId: string,
  nodeId: string,
  dbHandle: DbOrTx = db,
): Promise<boolean> {
  const [masteryPassed, cards] = await Promise.all([
    hasMasteryPassed(userId, nodeId, dbHandle),
    loadCardRecallInfos(userId, nodeId, dbHandle),
  ]);

  const decision = decideMastery({ masteryPassed, cards });
  if (decision.mastered) {
    await upsertProgress(
      userId,
      nodeId,
      { status: "mastered", masteredAt: new Date() },
      dbHandle,
    );
    return true;
  }
  return false;
}
