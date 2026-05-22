import { describe, expect, it } from "vitest";

import {
  computeRoadmapView,
  isNodeUnlocked,
  type RoadmapNodeInput,
} from "./status";

const baseNodes: RoadmapNodeInput[] = [
  { id: "A", slug: "a", title: "A", estimatedMinutes: 10, positionX: 0, positionY: 0 },
  { id: "B", slug: "b", title: "B", estimatedMinutes: 10, positionX: 0, positionY: 0 },
  { id: "C", slug: "c", title: "C", estimatedMinutes: 10, positionX: 0, positionY: 0 },
];

describe("computeRoadmapView", () => {
  it("unlocks nodes with no prerequisites when no progress exists", () => {
    const view = computeRoadmapView(baseNodes, [], []);
    for (const n of view.nodes) {
      expect(n.status).toBe("locked");
      expect(n.unmetPrerequisiteTitles).toEqual([]);
      expect(isNodeUnlocked(n)).toBe(true);
    }
    expect(view.totals).toEqual({ mastered: 0, inProgress: 0, locked: 3, total: 3 });
  });

  it("marks nodes with unmet prerequisites as locked and lists prereq titles", () => {
    const view = computeRoadmapView(
      baseNodes,
      [{ nodeId: "B", prerequisiteNodeId: "A" }],
      [],
    );
    const b = view.nodes.find((n) => n.id === "B");
    expect(b?.status).toBe("locked");
    expect(b?.unmetPrerequisiteTitles).toEqual(["A"]);
    expect(isNodeUnlocked(b!)).toBe(false);
  });

  it("unlocks downstream node once all prerequisites are mastered", () => {
    const view = computeRoadmapView(
      baseNodes,
      [{ nodeId: "B", prerequisiteNodeId: "A" }],
      [{ nodeId: "A", status: "mastered" }],
    );
    const a = view.nodes.find((n) => n.id === "A");
    const b = view.nodes.find((n) => n.id === "B");
    expect(a?.status).toBe("mastered");
    expect(b?.unmetPrerequisiteTitles).toEqual([]);
    expect(isNodeUnlocked(b!)).toBe(true);
  });

  it("respects stored in_progress status even if prerequisites are met", () => {
    const view = computeRoadmapView(
      baseNodes,
      [{ nodeId: "B", prerequisiteNodeId: "A" }],
      [
        { nodeId: "A", status: "mastered" },
        { nodeId: "B", status: "in_progress" },
      ],
    );
    expect(view.nodes.find((n) => n.id === "B")?.status).toBe("in_progress");
    expect(view.totals).toEqual({
      mastered: 1,
      inProgress: 1,
      locked: 1,
      total: 3,
    });
  });

  it("aggregates multiple unmet prerequisites", () => {
    const view = computeRoadmapView(
      baseNodes,
      [
        { nodeId: "C", prerequisiteNodeId: "A" },
        { nodeId: "C", prerequisiteNodeId: "B" },
      ],
      [{ nodeId: "A", status: "mastered" }],
    );
    const c = view.nodes.find((n) => n.id === "C");
    expect(c?.status).toBe("locked");
    expect(c?.unmetPrerequisiteTitles).toEqual(["B"]);
  });

  it("emits edges keyed source=prereq -> target=dependent", () => {
    const view = computeRoadmapView(
      baseNodes,
      [{ nodeId: "B", prerequisiteNodeId: "A" }],
      [],
    );
    expect(view.edges).toEqual([{ id: "A->B", source: "A", target: "B" }]);
  });

  it("exploreMode: treats every node as available, ignoring prereqs", () => {
    // Without exploreMode, B and C are locked (need A and B respectively).
    const view = computeRoadmapView(
      baseNodes,
      [
        { nodeId: "B", prerequisiteNodeId: "A" },
        { nodeId: "C", prerequisiteNodeId: "B" },
      ],
      [],
      { exploreMode: true },
    );
    for (const n of view.nodes) {
      expect(n.unmetPrerequisiteTitles).toEqual([]);
      expect(isNodeUnlocked(n)).toBe(true);
    }
  });

  it("exploreMode: still respects stored mastered/in_progress status", () => {
    const view = computeRoadmapView(
      baseNodes,
      [{ nodeId: "B", prerequisiteNodeId: "A" }],
      [
        { nodeId: "A", status: "mastered" },
        { nodeId: "C", status: "in_progress" },
      ],
      { exploreMode: true },
    );
    expect(view.nodes.find((n) => n.id === "A")?.status).toBe("mastered");
    expect(view.nodes.find((n) => n.id === "C")?.status).toBe("in_progress");
    // B has unmet prereq A=mastered (so met anyway), but in exploreMode
    // we'd still expect it available with no badge.
    const b = view.nodes.find((n) => n.id === "B");
    expect(b?.unmetPrerequisiteTitles).toEqual([]);
    expect(isNodeUnlocked(b!)).toBe(true);
  });
});
