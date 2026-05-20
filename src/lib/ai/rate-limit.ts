import "server-only";

import { and, count, eq, gte } from "drizzle-orm";

import { db } from "@/lib/db";
import { userEvents } from "@/db/schema";

export interface RateLimitOptions {
  userId: string;
  verb: string;
  /** Window size in seconds. */
  windowSeconds: number;
  /** Maximum events allowed in the window. */
  limit: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Events the user has already accrued inside the window. */
  used: number;
  limit: number;
  windowSeconds: number;
}

/**
 * Slide a window of `windowSeconds` back from now and count user_events for
 * `userId` with the given verb. Returns whether the next request would push
 * past `limit`. Doesn't record anything — callers persist their own event
 * row once the request actually fires.
 */
export async function checkRateLimit(
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const since = new Date(Date.now() - opts.windowSeconds * 1000);
  const row = await db
    .select({ n: count() })
    .from(userEvents)
    .where(
      and(
        eq(userEvents.userId, opts.userId),
        eq(userEvents.verb, opts.verb),
        gte(userEvents.createdAt, since),
      ),
    );
  const used = row[0]?.n ?? 0;
  return {
    allowed: used < opts.limit,
    used,
    limit: opts.limit,
    windowSeconds: opts.windowSeconds,
  };
}

/** Free-tier limit per ROADMAP: 20 tutor messages / 10 minutes. */
export const TUTOR_FREE_LIMIT_PER_10MIN = 20;
