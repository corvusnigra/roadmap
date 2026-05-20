import { describe, expect, it } from "vitest";

import { newCardState, reviewCard, type CardStateRow } from "./scheduler";

const NOW = new Date("2026-01-01T00:00:00Z");

function daysUntil(due: Date, base: Date) {
  return (due.getTime() - base.getTime()) / (1000 * 60 * 60 * 24);
}

describe("reviewCard — first encounter", () => {
  it("returns a 'learning' (or further) state after the first grade", () => {
    const next = reviewCard(null, 3, NOW);
    expect(["learning", "review"]).toContain(next.state);
    expect(next.reps).toBe(1);
    expect(next.lapses).toBe(0);
    expect(daysUntil(next.dueAt, NOW)).toBeGreaterThan(0);
  });

  it("Again on a new card schedules sooner than Good", () => {
    const again = reviewCard(null, 1, NOW);
    const good = reviewCard(null, 3, NOW);
    expect(daysUntil(again.dueAt, NOW)).toBeLessThanOrEqual(
      daysUntil(good.dueAt, NOW),
    );
  });

  it("Easy on a new card never schedules sooner than Good", () => {
    const easy = reviewCard(null, 4, NOW);
    const good = reviewCard(null, 3, NOW);
    expect(daysUntil(easy.dueAt, NOW)).toBeGreaterThanOrEqual(
      daysUntil(good.dueAt, NOW),
    );
  });
});

describe("reviewCard — repeated review", () => {
  it("Again increments lapses and pushes state away from review", () => {
    // Start from a card that's already in review with a non-trivial stability
    // (simulate the user having graded Good a few times).
    let card: CardStateRow | null = null;
    let t = NOW;
    for (let i = 0; i < 3; i++) {
      card = reviewCard(card, 3, t);
      t = new Date(card.dueAt.getTime());
    }
    const lapsesBefore = card!.lapses;
    const stateBefore = card!.state;
    const afterAgain = reviewCard(card, 1, t);
    expect(afterAgain.lapses).toBe(lapsesBefore + 1);
    // After Again the scheduler moves into relearning (or stays/falls back to
    // learning) — anything but "review" indicates the lapse was registered.
    expect(afterAgain.state).not.toBe(stateBefore === "review" ? "review" : afterAgain.state);
  });

  it("repeated Good monotonically grows the interval", () => {
    let card: CardStateRow | null = null;
    let prevInterval = 0;
    let t = NOW;
    const intervals: number[] = [];
    for (let i = 0; i < 5; i++) {
      const next: CardStateRow = reviewCard(card, 3, t);
      const interval = daysUntil(next.dueAt, t);
      intervals.push(interval);
      // First step has interval 0 (still learning); after that it must grow.
      if (i >= 2) {
        expect(interval).toBeGreaterThanOrEqual(prevInterval);
      }
      prevInterval = interval;
      card = next;
      t = new Date(next.dueAt.getTime());
    }
    expect(intervals.length).toBe(5);
  });

  it("Easy never schedules sooner than Good for the same prev state", () => {
    // Simulate a card already in review.
    let card: CardStateRow | null = null;
    let t = NOW;
    for (let i = 0; i < 4; i++) {
      card = reviewCard(card, 3, t);
      t = new Date(card.dueAt.getTime());
    }
    const good = reviewCard(card, 3, t);
    const easy = reviewCard(card, 4, t);
    expect(daysUntil(easy.dueAt, t)).toBeGreaterThanOrEqual(
      daysUntil(good.dueAt, t),
    );
  });
});

describe("reviewCard — invariants over 100 random grades", () => {
  it("produces non-decreasing reps and finite intervals", () => {
    let card: CardStateRow | null = null;
    let t = NOW;
    let prevReps = 0;
    for (let i = 0; i < 100; i++) {
      const rating = ((i % 4) + 1) as 1 | 2 | 3 | 4;
      const next: CardStateRow = reviewCard(card, rating, t);
      expect(Number.isFinite(next.stability)).toBe(true);
      expect(Number.isFinite(next.difficulty)).toBe(true);
      expect(next.reps).toBeGreaterThanOrEqual(prevReps);
      prevReps = next.reps;
      // Don't allow scheduling into the past.
      expect(next.dueAt.getTime()).toBeGreaterThanOrEqual(t.getTime());
      card = next;
      t = new Date(next.dueAt.getTime());
    }
  });
});

describe("newCardState", () => {
  it("returns a state with reps=0 and state='new'", () => {
    const s = newCardState(NOW);
    expect(s.reps).toBe(0);
    expect(s.lapses).toBe(0);
    expect(s.state).toBe("new");
    expect(s.stability).toBeDefined();
  });
});
