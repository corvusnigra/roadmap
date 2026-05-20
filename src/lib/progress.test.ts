import { describe, expect, it } from "vitest";

import { computeStreak, pickRecommendedNode } from "./progress-core";

function n(
  id: string,
  status: "locked" | "in_progress" | "mastered" | null,
  positionX = 0,
  positionY = 0,
) {
  return {
    id,
    slug: id,
    title: id.toUpperCase(),
    positionX,
    positionY,
    status,
  };
}

describe("pickRecommendedNode", () => {
  it("returns null when there are no nodes", () => {
    expect(pickRecommendedNode([], [])).toBeNull();
  });

  it("returns the only unlocked-not-started node", () => {
    const nodes = [n("a", null, 0)];
    expect(pickRecommendedNode(nodes, [])).toMatchObject({ slug: "a" });
  });

  it("skips mastered and in_progress nodes", () => {
    const nodes = [n("a", "mastered", 0), n("b", "in_progress", 10), n("c", null, 20)];
    expect(pickRecommendedNode(nodes, [])).toMatchObject({ slug: "c" });
  });

  it("requires every prerequisite to be mastered", () => {
    const nodes = [n("a", null, 0), n("b", null, 10)];
    // b depends on a; a isn't mastered → b is NOT a candidate.
    // a has no prereqs, so a IS the candidate.
    expect(
      pickRecommendedNode(nodes, [{ nodeId: "b", prereqId: "a" }]),
    ).toMatchObject({ slug: "a" });
  });

  it("unlocks the downstream node once the prereq is mastered", () => {
    const nodes = [n("a", "mastered", 0), n("b", null, 10)];
    expect(
      pickRecommendedNode(nodes, [{ nodeId: "b", prereqId: "a" }]),
    ).toMatchObject({ slug: "b" });
  });

  it("breaks ties on positionX, then positionY, then slug", () => {
    const nodes = [
      n("z", null, 100, 0),
      n("a", null, 50, 0),
      n("m", null, 50, 0), // tied with a on positionX
    ];
    // a and m share positionX=50; alphabetical → a wins.
    expect(pickRecommendedNode(nodes, [])).toMatchObject({ slug: "a" });
  });

  it("returns null when every node is mastered", () => {
    const nodes = [n("a", "mastered", 0), n("b", "mastered", 10)];
    expect(pickRecommendedNode(nodes, [])).toBeNull();
  });
});

describe("computeStreak", () => {
  it("returns 0 when there's no activity at all", () => {
    expect(computeStreak(new Set(), "2026-05-20")).toBe(0);
  });

  it("counts a single-day streak when only today has activity", () => {
    const days = new Set(["2026-05-20"]);
    expect(computeStreak(days, "2026-05-20")).toBe(1);
  });

  it("counts consecutive days backwards", () => {
    const days = new Set([
      "2026-05-20",
      "2026-05-19",
      "2026-05-18",
      "2026-05-15", // gap day — should not extend the streak
      "2026-05-14",
    ]);
    expect(computeStreak(days, "2026-05-20")).toBe(3);
  });

  it("anchors at yesterday when today has no activity yet", () => {
    const days = new Set(["2026-05-19", "2026-05-18", "2026-05-17"]);
    expect(computeStreak(days, "2026-05-20")).toBe(3);
  });

  it("returns 0 when neither today nor yesterday have activity", () => {
    const days = new Set(["2026-05-15", "2026-05-14"]);
    expect(computeStreak(days, "2026-05-20")).toBe(0);
  });
});
