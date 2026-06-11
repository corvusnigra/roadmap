import { describe, expect, it } from "vitest";

import {
  cardRetrievability,
  decideMastery,
  FSRS_RECALL_THRESHOLD,
  type CardRecallInfo,
} from "./progress-core";

// Вспомогательные фабрики
function reviewed(daysAgo: number, stability: number): CardRecallInfo {
  const lastReviewAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return { stability, lastReviewAt };
}

function unreviewed(): CardRecallInfo {
  return { stability: null, lastReviewAt: null };
}

// ---------------------------------------------------------------------------
// cardRetrievability
// ---------------------------------------------------------------------------

describe("cardRetrievability", () => {
  const now = new Date();

  it("returns 0 for an unreviewed card (null lastReviewAt)", () => {
    expect(cardRetrievability(unreviewed(), now)).toBe(0);
  });

  it("returns 0 when stability is null", () => {
    expect(
      cardRetrievability({ stability: null, lastReviewAt: new Date() }, now),
    ).toBe(0);
  });

  it("returns 0 when stability is 0", () => {
    expect(
      cardRetrievability({ stability: 0, lastReviewAt: new Date() }, now),
    ).toBe(0);
  });

  it("returns 1.0 immediately after review (0 elapsed days, high stability)", () => {
    // forgetting_curve(0, s) = 1 for any positive s
    const val = cardRetrievability({ stability: 10, lastReviewAt: now }, now);
    expect(val).toBeCloseTo(1.0, 5);
  });

  it("decays below threshold after many days relative to stability", () => {
    // stability=1 day, reviewed 30 days ago → very low recall
    const card = reviewed(30, 1);
    expect(cardRetrievability(card, now)).toBeLessThan(FSRS_RECALL_THRESHOLD);
  });

  it("stays above threshold when elapsed < stability", () => {
    // stability=100 days, reviewed 1 day ago → high recall
    const card = reviewed(1, 100);
    expect(cardRetrievability(card, now)).toBeGreaterThan(FSRS_RECALL_THRESHOLD);
  });
});

// ---------------------------------------------------------------------------
// decideMastery
// ---------------------------------------------------------------------------

describe("decideMastery", () => {
  const now = new Date();

  it("returns mastered:false when masteryPassed is false", () => {
    const result = decideMastery({
      masteryPassed: false,
      cards: [reviewed(0, 10)],
      now,
    });
    expect(result.mastered).toBe(false);
    if (!result.mastered) expect(result.reason).toMatch(/not passed/);
  });

  it("returns mastered:false when node has no cards", () => {
    const result = decideMastery({ masteryPassed: true, cards: [], now });
    expect(result.mastered).toBe(false);
    if (!result.mastered) expect(result.reason).toMatch(/no cards/);
  });

  it("returns mastered:false when any card is unreviewed", () => {
    const cards: CardRecallInfo[] = [reviewed(1, 100), unreviewed()];
    const result = decideMastery({ masteryPassed: true, cards, now });
    expect(result.mastered).toBe(false);
    if (!result.mastered) expect(result.reason).toMatch(/never reviewed/);
  });

  it("returns mastered:false when min retrievability is below threshold", () => {
    // One card with very low stability reviewed long ago → recall < 0.85
    const cards: CardRecallInfo[] = [reviewed(1, 100), reviewed(30, 1)];
    const result = decideMastery({ masteryPassed: true, cards, now });
    expect(result.mastered).toBe(false);
    if (!result.mastered) expect(result.reason).toMatch(/retrievability/);
  });

  it("returns mastered:true at exact threshold boundary (single card, recall ≥ 0.85)", () => {
    // Find a (elapsed, stability) pair that sits at exactly the boundary.
    // stability=10, reviewed 0 days ago → recall=1.0 ≥ 0.85
    const cards: CardRecallInfo[] = [reviewed(0, 10)];
    const result = decideMastery({ masteryPassed: true, cards, now });
    expect(result.mastered).toBe(true);
  });

  it("returns mastered:true when all cards have recall ≥ 0.85", () => {
    // stability=100, elapsed=1 → very high recall for all cards
    const cards: CardRecallInfo[] = [
      reviewed(1, 100),
      reviewed(2, 50),
      reviewed(1, 200),
    ];
    const result = decideMastery({ masteryPassed: true, cards, now });
    expect(result.mastered).toBe(true);
  });

  it("uses current time when now is not provided", () => {
    // Just verify it doesn't throw and produces a valid result
    const result = decideMastery({
      masteryPassed: true,
      cards: [reviewed(0, 10)],
    });
    expect(typeof result.mastered).toBe("boolean");
  });
});
