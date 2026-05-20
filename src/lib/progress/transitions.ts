import "server-only";

import { and, count, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  userEvents,
  userNodeProgress,
  type NewUserNodeProgress,
} from "@/db/schema";
import { captureEvent } from "@/lib/analytics/posthog";

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
): Promise<void> {
  await db.insert(userEvents).values({
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
): Promise<void> {
  await db
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

async function eventCount(
  userId: string,
  verb: string,
  objectId: string,
): Promise<number> {
  const row = await db
    .select({ n: count() })
    .from(userEvents)
    .where(
      and(
        eq(userEvents.userId, userId),
        eq(userEvents.verb, verb),
        eq(userEvents.objectId, objectId),
      ),
    );
  return row[0]?.n ?? 0;
}

/**
 * Promote a node to `mastered` iff the user has at least one mastery_passed
 * AND one card_reviewed event for it. Returns true if the row flipped.
 */
export async function maybeFlipMastered(
  userId: string,
  nodeId: string,
): Promise<boolean> {
  const [passes, reviews] = await Promise.all([
    eventCount(userId, "mastery_passed", nodeId),
    eventCount(userId, "card_reviewed", nodeId),
  ]);
  if (passes > 0 && reviews > 0) {
    await upsertProgress(userId, nodeId, {
      status: "mastered",
      masteredAt: new Date(),
    });
    return true;
  }
  return false;
}
