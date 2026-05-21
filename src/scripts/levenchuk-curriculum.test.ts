import { describe, expect, it } from "vitest";

import {
  LEVENCHUK_DISCIPLINES,
  buildLevenchukNodeSeeds,
  disciplinePosition,
} from "./levenchuk-curriculum";
import { pickFour } from "./scaffold-levenchuk";

describe("buildLevenchukNodeSeeds", () => {
  const seeds = buildLevenchukNodeSeeds();
  const bySlug = new Map(seeds.map((s) => [s.slug, s]));

  it("includes every discipline exactly once", () => {
    expect(seeds.length).toBe(LEVENCHUK_DISCIPLINES.length);
    for (const d of LEVENCHUK_DISCIPLINES) {
      expect(bySlug.has(d.slug)).toBe(true);
    }
  });

  it("makes lev-setup the only root (no prerequisites)", () => {
    const roots = seeds.filter((s) => s.prerequisites.length === 0);
    expect(roots).toHaveLength(1);
    expect(roots[0]!.slug).toBe("lev-setup");
  });

  it("forms a single linear chain — every non-root has exactly one prereq", () => {
    for (const s of seeds) {
      if (s.slug === "lev-setup") continue;
      expect(s.prerequisites).toHaveLength(1);
    }
  });

  it("references only known slugs in prerequisites", () => {
    for (const s of seeds) {
      for (const p of s.prerequisites) {
        expect(bySlug.has(p)).toBe(true);
      }
    }
  });

  it("has no cycles — chain reaches lev-setup from every node", () => {
    for (const s of seeds) {
      const visited = new Set<string>();
      let cur: string | undefined = s.slug;
      while (cur && cur !== "lev-setup") {
        expect(visited.has(cur)).toBe(false);
        visited.add(cur);
        const node = bySlug.get(cur);
        cur = node?.prerequisites[0];
      }
      expect(cur).toBe("lev-setup");
    }
  });

  it("bridges levels: first node of Lk depends on last node of L(k-1)", () => {
    // lev-sobr is the first node of L1; its prereq should be the last
    // node of L0 (lev-team).
    expect(bySlug.get("lev-sobr")?.prerequisites).toEqual(["lev-team"]);
    // lev-top is the first node of L2; prereq = last of L1 = lev-ont.
    expect(bySlug.get("lev-top")?.prerequisites).toEqual(["lev-ont"]);
  });
});

describe("disciplinePosition", () => {
  it("spaces columns by 360px", () => {
    expect(disciplinePosition(0, 0).x).toBe(0);
    expect(disciplinePosition(1, 0).x).toBe(360);
    expect(disciplinePosition(6, 0).x).toBe(2160);
  });

  it("spaces rows by 130px within a column", () => {
    expect(disciplinePosition(2, 0).y).toBe(0);
    expect(disciplinePosition(2, 1).y).toBe(130);
    expect(disciplinePosition(2, 5).y).toBe(650);
  });
});

describe("pickFour", () => {
  it("returns exactly 4 options with `correct` first", () => {
    const out = pickFour(["a", "b", "c", "d", "e"], "X");
    expect(out).toHaveLength(4);
    expect(out[0]).toBe("X");
    expect(out).toEqual(["X", "a", "b", "c"]);
  });

  it("excludes the correct answer from distractors", () => {
    const out = pickFour(["a", "X", "b"], "X");
    expect(out[0]).toBe("X");
    expect(out.slice(1)).not.toContain("X");
  });

  it("deduplicates distractors", () => {
    const out = pickFour(["a", "a", "a"], "X");
    expect(out).toHaveLength(4);
    // distractor 'a' once, then fillers
    expect(out.filter((o) => o === "a")).toHaveLength(1);
  });

  it("pads with universal fillers when items is empty", () => {
    const out = pickFour([], "X");
    expect(out).toHaveLength(4);
    expect(out[0]).toBe("X");
    // Fillers shouldn't equal the correct answer.
    expect(out.slice(1).every((o) => o !== "X")).toBe(true);
  });

  it("never returns duplicates across correct + distractors + fillers", () => {
    const out = pickFour(["a"], "X");
    const unique = new Set(out);
    expect(unique.size).toBe(out.length);
  });
});
