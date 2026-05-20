"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  nodePrerequisites,
  nodes as nodesTable,
  userEvents,
  userNodeProgress,
} from "@/db/schema";
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
  gradeReinforcementCard: z.object({
    roleSlug: z.string().regex(/^[a-z0-9-]+$/),
    nodeSlug: z.string().regex(/^[a-z0-9-]+$/),
    cardKey: z.string().min(1),
    rating: z.number().int().min(1).max(4),
  }),
} as const;

/** Pass threshold for the mastery quiz — 4 of 5, per ROADMAP. */
const MASTERY_PASS_RATIO = 0.8;

async function requireUserAndNode(input: { roleSlug: string; nodeSlug: string }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const node = await db
    .select({ id: nodesTable.id })
    .from(nodesTable)
    .where(eq(nodesTable.slug, input.nodeSlug))
    .limit(1)
    .then((r) => r[0]);
  if (!node) throw new Error(`Unknown node slug: ${input.nodeSlug}`);

  return { userId: user.id, nodeId: node.id };
}

/** Are all of this node's prerequisites already mastered by this user? */
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

async function logEvent(
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
}

async function upsertProgress(
  userId: string,
  nodeId: string,
  patch: Partial<typeof userNodeProgress.$inferInsert>,
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

export async function markTheoryRead(
  raw: z.input<typeof ServerActionInputs.markTheoryRead>,
) {
  const input = ServerActionInputs.markTheoryRead.parse(raw);
  const { userId, nodeId } = await requireUserAndNode(input);

  if (!(await arePrereqsSatisfied(userId, nodeId))) {
    throw new Error("Cannot start a node whose prerequisites aren't mastered.");
  }

  const current = await db
    .select({ status: userNodeProgress.status })
    .from(userNodeProgress)
    .where(
      and(
        eq(userNodeProgress.userId, userId),
        eq(userNodeProgress.nodeId, nodeId),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  // Only flip locked -> in_progress; in_progress / mastered are unchanged.
  if (current?.status !== "in_progress" && current?.status !== "mastered") {
    await upsertProgress(userId, nodeId, {
      status: "in_progress",
      startedAt: new Date(),
    });
  }

  await logEvent(userId, "theory_read", "node", nodeId);
  revalidatePath(`/roles/${input.roleSlug}/nodes/${input.nodeSlug}`);
  revalidatePath(`/roles/${input.roleSlug}`);
}

export async function recordPracticeCorrect(
  raw: z.input<typeof ServerActionInputs.recordPracticeCorrect>,
) {
  const input = ServerActionInputs.recordPracticeCorrect.parse(raw);
  const { userId, nodeId } = await requireUserAndNode(input);
  await logEvent(userId, "practice_correct", "node", nodeId, {
    itemKey: input.itemKey,
  });
}

async function countMasteryPasses(
  userId: string,
  nodeId: string,
): Promise<number> {
  const row = await db
    .select({ n: count() })
    .from(userEvents)
    .where(
      and(
        eq(userEvents.userId, userId),
        eq(userEvents.verb, "mastery_passed"),
        eq(userEvents.objectId, nodeId),
      ),
    );
  return row[0]?.n ?? 0;
}

async function countCardReviews(
  userId: string,
  nodeId: string,
): Promise<number> {
  const row = await db
    .select({ n: count() })
    .from(userEvents)
    .where(
      and(
        eq(userEvents.userId, userId),
        eq(userEvents.verb, "card_reviewed"),
        eq(userEvents.objectId, nodeId),
      ),
    );
  return row[0]?.n ?? 0;
}

async function maybeFlipMastered(
  userId: string,
  nodeId: string,
): Promise<boolean> {
  const [passes, reviews] = await Promise.all([
    countMasteryPasses(userId, nodeId),
    countCardReviews(userId, nodeId),
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

export async function submitMasteryQuiz(
  raw: z.input<typeof ServerActionInputs.submitMasteryQuiz>,
) {
  const input = ServerActionInputs.submitMasteryQuiz.parse(raw);
  const { userId, nodeId } = await requireUserAndNode(input);

  const ratio = input.score / input.total;
  const passed = ratio >= MASTERY_PASS_RATIO;

  await logEvent(
    userId,
    passed ? "mastery_passed" : "mastery_failed",
    "node",
    nodeId,
    { score: input.score, total: input.total, ratio },
  );

  if (passed) {
    // Persist the score on the progress row so we don't lose it if a later
    // attempt scores worse.
    await upsertProgress(userId, nodeId, {
      status: "in_progress",
      masteryScore: ratio,
    });
    const flipped = await maybeFlipMastered(userId, nodeId);
    revalidatePath(`/roles/${input.roleSlug}/nodes/${input.nodeSlug}`);
    revalidatePath(`/roles/${input.roleSlug}`);
    return { passed: true, mastered: flipped, score: input.score };
  }

  return { passed: false, mastered: false, score: input.score };
}

export async function gradeReinforcementCard(
  raw: z.input<typeof ServerActionInputs.gradeReinforcementCard>,
) {
  const input = ServerActionInputs.gradeReinforcementCard.parse(raw);
  const { userId, nodeId } = await requireUserAndNode(input);

  await logEvent(userId, "card_reviewed", "node", nodeId, {
    cardKey: input.cardKey,
    rating: input.rating,
  });

  const flipped = await maybeFlipMastered(userId, nodeId);
  if (flipped) {
    revalidatePath(`/roles/${input.roleSlug}/nodes/${input.nodeSlug}`);
    revalidatePath(`/roles/${input.roleSlug}`);
  }
  return { mastered: flipped };
}
