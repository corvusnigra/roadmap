import "server-only";

import { and, eq, inArray, lte, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  nodes as nodesTable,
  roles as rolesTable,
  skillCards,
  userCardState,
  userNodeProgress,
} from "@/db/schema";

import type { CardStateRow } from "@/lib/fsrs/scheduler";

export interface DueCard {
  cardId: string;
  nodeId: string;
  nodeSlug: string;
  nodeTitle: string;
  roleSlug: string;
  prompt: string;
  answerMarkdown: string;
  /** null when the user has never graded this card. */
  state: CardStateRow | null;
}

interface RawRow {
  cardId: string;
  nodeId: string;
  nodeSlug: string;
  nodeTitle: string;
  roleSlug: string;
  prompt: string;
  answerMarkdown: string;
  stability: number | null;
  difficulty: number | null;
  dueAt: Date | null;
  reps: number | null;
  lapses: number | null;
  lastReviewAt: Date | null;
  state: "new" | "learning" | "review" | "relearning" | null;
}

function rowToDueCard(row: RawRow): DueCard {
  const hasState = row.stability !== null;
  return {
    cardId: row.cardId,
    nodeId: row.nodeId,
    nodeSlug: row.nodeSlug,
    nodeTitle: row.nodeTitle,
    roleSlug: row.roleSlug,
    prompt: row.prompt,
    answerMarkdown: row.answerMarkdown,
    state: hasState
      ? {
          stability: row.stability ?? 0,
          difficulty: row.difficulty ?? 0,
          dueAt: row.dueAt ?? new Date(),
          reps: row.reps ?? 0,
          lapses: row.lapses ?? 0,
          lastReviewAt: row.lastReviewAt,
          state: row.state ?? "new",
        }
      : null,
  };
}

/**
 * Cards across every node the user has started (in_progress or mastered) that
 * are either brand-new (no user_card_state row) or whose due_at has passed.
 * Sorted by due_at ascending (NULLS FIRST so new cards bubble up).
 */
export async function getDueCards(
  userId: string,
  limit = 25,
): Promise<DueCard[]> {
  const now = new Date();
  const rows = await db
    .select({
      cardId: skillCards.id,
      nodeId: skillCards.nodeId,
      nodeSlug: nodesTable.slug,
      nodeTitle: nodesTable.title,
      roleSlug: rolesTable.slug,
      prompt: skillCards.prompt,
      answerMarkdown: skillCards.answerMarkdown,
      stability: userCardState.stability,
      difficulty: userCardState.difficulty,
      dueAt: userCardState.dueAt,
      reps: userCardState.reps,
      lapses: userCardState.lapses,
      lastReviewAt: userCardState.lastReviewAt,
      state: userCardState.state,
    })
    .from(skillCards)
    .innerJoin(nodesTable, eq(nodesTable.id, skillCards.nodeId))
    .innerJoin(rolesTable, eq(rolesTable.id, nodesTable.roleId))
    .innerJoin(
      userNodeProgress,
      and(
        eq(userNodeProgress.nodeId, skillCards.nodeId),
        eq(userNodeProgress.userId, userId),
      ),
    )
    .leftJoin(
      userCardState,
      and(
        eq(userCardState.cardId, skillCards.id),
        eq(userCardState.userId, userId),
      ),
    )
    .where(
      and(
        inArray(userNodeProgress.status, ["in_progress", "mastered"] as const),
        or(
          sql`${userCardState.cardId} IS NULL`,
          lte(userCardState.dueAt, now),
        ),
      ),
    )
    .orderBy(sql`${userCardState.dueAt} ASC NULLS FIRST`)
    .limit(limit);

  return rows.map((r) => rowToDueCard(r as RawRow));
}

/** Subset of getDueCards scoped to a single node — used by the mini-review widget. */
export async function getDueCardsForNode(
  userId: string,
  nodeId: string,
  limit = 3,
): Promise<DueCard[]> {
  const now = new Date();
  const rows = await db
    .select({
      cardId: skillCards.id,
      nodeId: skillCards.nodeId,
      nodeSlug: nodesTable.slug,
      nodeTitle: nodesTable.title,
      roleSlug: rolesTable.slug,
      prompt: skillCards.prompt,
      answerMarkdown: skillCards.answerMarkdown,
      stability: userCardState.stability,
      difficulty: userCardState.difficulty,
      dueAt: userCardState.dueAt,
      reps: userCardState.reps,
      lapses: userCardState.lapses,
      lastReviewAt: userCardState.lastReviewAt,
      state: userCardState.state,
    })
    .from(skillCards)
    .innerJoin(nodesTable, eq(nodesTable.id, skillCards.nodeId))
    .innerJoin(rolesTable, eq(rolesTable.id, nodesTable.roleId))
    .leftJoin(
      userCardState,
      and(
        eq(userCardState.cardId, skillCards.id),
        eq(userCardState.userId, userId),
      ),
    )
    .where(
      and(
        eq(skillCards.nodeId, nodeId),
        or(
          sql`${userCardState.cardId} IS NULL`,
          lte(userCardState.dueAt, now),
        ),
      ),
    )
    .orderBy(sql`${userCardState.dueAt} ASC NULLS FIRST`)
    .limit(limit);

  return rows.map((r) => rowToDueCard(r as RawRow));
}
