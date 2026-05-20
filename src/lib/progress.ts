// DB-touching wrappers for the dashboard. Pure helpers
// (`pickRecommendedNode`, `computeStreak`) live in `./progress-core.ts` so
// unit tests don't drag in `@/lib/db` (which has `import "server-only"` and
// blows up under Vitest).

import { and, count, eq, gte, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  nodePrerequisites,
  nodes as nodesTable,
  userEvents,
  userNodeProgress,
} from "@/db/schema";
import {
  computeStreak,
  pickRecommendedNode,
  type NodeRowInput,
  type RecommendedNode,
} from "@/lib/progress-core";

export type { RecommendedNode } from "@/lib/progress-core";
export { computeStreak, pickRecommendedNode } from "@/lib/progress-core";

export interface RoleProgressTotals {
  mastered: number;
  inProgress: number;
  locked: number;
  total: number;
}

export async function computeRoleProgress(
  userId: string,
  roleId: string,
): Promise<RoleProgressTotals> {
  const [totalRow] = await db
    .select({ n: count() })
    .from(nodesTable)
    .where(eq(nodesTable.roleId, roleId));
  const total = totalRow?.n ?? 0;

  const counts = await db
    .select({ status: userNodeProgress.status, n: count() })
    .from(userNodeProgress)
    .innerJoin(
      nodesTable,
      and(
        eq(nodesTable.id, userNodeProgress.nodeId),
        eq(nodesTable.roleId, roleId),
      ),
    )
    .where(eq(userNodeProgress.userId, userId))
    .groupBy(userNodeProgress.status);

  let mastered = 0;
  let inProgress = 0;
  for (const row of counts) {
    if (row.status === "mastered") mastered = row.n;
    else if (row.status === "in_progress") inProgress = row.n;
  }
  const locked = Math.max(0, total - mastered - inProgress);
  return { mastered, inProgress, locked, total };
}

export async function getNextRecommendedNode(
  userId: string,
  roleId: string,
): Promise<RecommendedNode | null> {
  const nodeRows = await db
    .select({
      id: nodesTable.id,
      slug: nodesTable.slug,
      title: nodesTable.title,
      positionX: nodesTable.positionX,
      positionY: nodesTable.positionY,
      status: userNodeProgress.status,
    })
    .from(nodesTable)
    .leftJoin(
      userNodeProgress,
      and(
        eq(userNodeProgress.nodeId, nodesTable.id),
        eq(userNodeProgress.userId, userId),
      ),
    )
    .where(eq(nodesTable.roleId, roleId));

  const edgeRows = await db
    .select({
      nodeId: nodePrerequisites.nodeId,
      prereqId: nodePrerequisites.prerequisiteNodeId,
    })
    .from(nodePrerequisites)
    .innerJoin(nodesTable, eq(nodesTable.id, nodePrerequisites.nodeId))
    .where(eq(nodesTable.roleId, roleId));

  return pickRecommendedNode(nodeRows as NodeRowInput[], edgeRows);
}

/**
 * Format a UTC timestamp as a calendar date in the user's timezone, e.g.
 * "2026-05-20". Uses Intl.DateTimeFormat (built-in) so we avoid pulling in
 * date-fns-tz. The 'en-CA' locale produces ISO YYYY-MM-DD by default.
 */
function dateInZone(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

const ACTIVITY_VERBS = [
  "theory_read",
  "practice_correct",
  "mastery_passed",
  "mastery_failed",
  "card_reviewed",
  "tutor_message_sent",
  "node_opened",
] as const;

export interface DailyActivity {
  day: string;
  count: number;
}

export async function getStreak(
  userId: string,
  timeZone: string,
): Promise<number> {
  const horizon = new Date();
  horizon.setDate(horizon.getDate() - 60);
  const rows = await db
    .select({ createdAt: userEvents.createdAt })
    .from(userEvents)
    .where(
      and(
        eq(userEvents.userId, userId),
        gte(userEvents.createdAt, horizon),
        inArray(userEvents.verb, [...ACTIVITY_VERBS]),
      ),
    );

  const days = new Set(rows.map((r) => dateInZone(r.createdAt, timeZone)));
  const today = dateInZone(new Date(), timeZone);
  return computeStreak(days, today);
}

export async function getActivityByDay(
  userId: string,
  timeZone: string,
  days = 7,
): Promise<DailyActivity[]> {
  const horizon = new Date();
  horizon.setDate(horizon.getDate() - days - 1);
  const rows = await db
    .select({ createdAt: userEvents.createdAt })
    .from(userEvents)
    .where(
      and(
        eq(userEvents.userId, userId),
        gte(userEvents.createdAt, horizon),
        inArray(userEvents.verb, [...ACTIVITY_VERBS]),
      ),
    );

  const buckets = new Map<string, number>();
  for (const r of rows) {
    const key = dateInZone(r.createdAt, timeZone);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  const out: DailyActivity[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = dateInZone(d, timeZone);
    out.push({ day: key, count: buckets.get(key) ?? 0 });
  }
  return out;
}
