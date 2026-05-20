/**
 * Pure helpers for dashboard maths — no DB imports so they're cheap to unit
 * test with synthetic input. The DB-touching wrappers live in
 * `src/lib/progress.ts`.
 */

export interface RecommendedNode {
  id: string;
  slug: string;
  title: string;
  /** Distance from the mastered frontier — 1 for any candidate we surface. */
  depth: number;
}

export interface NodeRowInput {
  id: string;
  slug: string;
  title: string;
  positionX: number;
  positionY: number;
  status: "locked" | "in_progress" | "mastered" | null;
}

export interface EdgeRowInput {
  nodeId: string;
  prereqId: string;
}

export function pickRecommendedNode(
  nodes: NodeRowInput[],
  edges: EdgeRowInput[],
): RecommendedNode | null {
  const mastered = new Set(
    nodes.filter((n) => n.status === "mastered").map((n) => n.id),
  );
  const prereqsByNode = new Map<string, string[]>();
  for (const e of edges) {
    const list = prereqsByNode.get(e.nodeId) ?? [];
    list.push(e.prereqId);
    prereqsByNode.set(e.nodeId, list);
  }

  const candidates = nodes
    .filter((n) => n.status !== "mastered" && n.status !== "in_progress")
    .filter((n) => {
      const ps = prereqsByNode.get(n.id) ?? [];
      return ps.every((pid) => mastered.has(pid));
    })
    .sort(
      (a, b) =>
        a.positionX - b.positionX ||
        a.positionY - b.positionY ||
        a.slug.localeCompare(b.slug),
    );

  const picked = candidates[0];
  if (!picked) return null;
  return { id: picked.id, slug: picked.slug, title: picked.title, depth: 1 };
}

export function computeStreak(
  daysWithActivity: Set<string>,
  todayYmd: string,
): number {
  if (daysWithActivity.size === 0) return 0;
  const startCursor = (() => {
    if (daysWithActivity.has(todayYmd)) return ymdToDate(todayYmd);
    const yesterday = shiftYmd(todayYmd, -1);
    if (daysWithActivity.has(yesterday)) return ymdToDate(yesterday);
    return null;
  })();
  if (!startCursor) return 0;

  let streak = 0;
  let cursor = startCursor;
  while (true) {
    const key = ymdFromDate(cursor);
    if (!daysWithActivity.has(key)) break;
    streak += 1;
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }
  return streak;
}

function ymdFromDate(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ymdToDate(ymd: string): Date {
  return new Date(`${ymd}T12:00:00Z`);
}

function shiftYmd(ymd: string, days: number): string {
  const d = ymdToDate(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return ymdFromDate(d);
}
