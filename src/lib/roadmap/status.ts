/**
 * Pure lock-and-status computation for the roadmap canvas. Server-side
 * loaders feed in raw rows from the DB and get back per-node display state
 * (status + unmet prerequisites for lock tooltips/toasts). Kept dependency-
 * free so it stays unit-testable.
 */

export type NodeStatus = "locked" | "in_progress" | "mastered";

export interface RoadmapNodeInput {
  id: string;
  slug: string;
  title: string;
  estimatedMinutes: number;
  positionX: number;
  positionY: number;
}

export interface RoadmapEdgeInput {
  /** node that needs the prerequisite */
  nodeId: string;
  /** the prerequisite node */
  prerequisiteNodeId: string;
}

export type StoredProgressStatus = "locked" | "in_progress" | "mastered";

export interface RoadmapProgressInput {
  nodeId: string;
  status: StoredProgressStatus;
}

export interface RoadmapNodeView extends RoadmapNodeInput {
  status: NodeStatus;
  /** Titles of prerequisites the user still needs to master. Empty when status != 'locked'. */
  unmetPrerequisiteTitles: string[];
}

export interface RoadmapView {
  nodes: RoadmapNodeView[];
  /** Edge source = prerequisite, target = dependent node. */
  edges: { id: string; source: string; target: string }[];
  totals: { mastered: number; inProgress: number; locked: number; total: number };
}

export interface ComputeRoadmapOptions {
  /**
   * When true, prerequisite gating is suspended: every node is treated as
   * available, `unmetPrerequisiteTitles` is always empty, and progress
   * (`mastered` / `in_progress`) still wins for display badges. Intended
   * for curators/owners who want to browse the full graph without
   * grinding the mastery flow.
   */
  exploreMode?: boolean;
}

export function computeRoadmapView(
  nodes: RoadmapNodeInput[],
  edges: RoadmapEdgeInput[],
  progress: RoadmapProgressInput[],
  options: ComputeRoadmapOptions = {},
): RoadmapView {
  const progressByNode = new Map<string, StoredProgressStatus>();
  for (const p of progress) {
    progressByNode.set(p.nodeId, p.status);
  }

  const titleById = new Map<string, string>();
  for (const n of nodes) {
    titleById.set(n.id, n.title);
  }

  // node id -> list of prerequisite ids
  const prereqsByNode = new Map<string, string[]>();
  for (const e of edges) {
    const list = prereqsByNode.get(e.nodeId) ?? [];
    list.push(e.prerequisiteNodeId);
    prereqsByNode.set(e.nodeId, list);
  }

  const enriched: RoadmapNodeView[] = nodes.map((node) => {
    const stored = progressByNode.get(node.id);
    if (stored === "mastered") {
      return {
        ...node,
        status: "mastered",
        unmetPrerequisiteTitles: [],
      };
    }
    if (stored === "in_progress") {
      return {
        ...node,
        status: "in_progress",
        unmetPrerequisiteTitles: [],
      };
    }
    // Either stored === "locked" or no row — recompute from prerequisites so
    // a user who completes a prereq sees the downstream node unlock without
    // any background job to flip the row.
    const prereqIds = prereqsByNode.get(node.id) ?? [];
    const unmetIds = options.exploreMode
      ? []
      : prereqIds.filter((pid) => progressByNode.get(pid) !== "mastered");
    if (unmetIds.length === 0) {
      return {
        ...node,
        // No prereqs left and no progress row yet — the node is "available",
        // which we surface as in_progress=false but unlocked. We model this
        // as `in_progress` only after the user has actually started. Until
        // then the badge says "Available" but the canvas treats it as
        // unlocked. We re-use the `locked` enum slot with an empty unmet
        // list to mean "available" in the view.
        status: "locked",
        unmetPrerequisiteTitles: [],
      };
    }
    return {
      ...node,
      status: "locked",
      unmetPrerequisiteTitles: unmetIds
        .map((id) => titleById.get(id) ?? "")
        .filter(Boolean),
    };
  });

  const totals = enriched.reduce(
    (acc, n) => {
      acc.total += 1;
      if (n.status === "mastered") acc.mastered += 1;
      else if (n.status === "in_progress") acc.inProgress += 1;
      else acc.locked += 1;
      return acc;
    },
    { mastered: 0, inProgress: 0, locked: 0, total: 0 },
  );

  return {
    nodes: enriched,
    edges: edges.map((e) => ({
      id: `${e.prerequisiteNodeId}->${e.nodeId}`,
      source: e.prerequisiteNodeId,
      target: e.nodeId,
    })),
    totals,
  };
}

/** True when the node has no unmet prerequisites — safe to navigate into. */
export function isNodeUnlocked(node: RoadmapNodeView): boolean {
  return node.status !== "locked" || node.unmetPrerequisiteTitles.length === 0;
}
