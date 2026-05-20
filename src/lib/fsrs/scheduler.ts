/**
 * Thin orchestration layer over the ts-fsrs package. Pure: never reads from
 * or writes to the DB. Server actions sit on top of this and own persistence.
 */

import {
  createEmptyCard,
  fsrs,
  Rating as FsrsRating,
  State as FsrsState,
  type Card as FsrsCard,
  type Grade,
} from "ts-fsrs";

export type Rating = 1 | 2 | 3 | 4; // Again | Hard | Good | Easy

export type CardStateLabel = "new" | "learning" | "review" | "relearning";

/**
 * Mirror of the user_card_state row that's relevant to scheduling. Stored as
 * a serializable plain object — anything from the DB column set fits here.
 */
export interface CardStateRow {
  stability: number;
  difficulty: number;
  dueAt: Date;
  reps: number;
  lapses: number;
  lastReviewAt: Date | null;
  state: CardStateLabel;
}

const STATE_TO_DB: Record<FsrsState, CardStateLabel> = {
  [FsrsState.New]: "new",
  [FsrsState.Learning]: "learning",
  [FsrsState.Review]: "review",
  [FsrsState.Relearning]: "relearning",
};

const STATE_FROM_DB: Record<CardStateLabel, FsrsState> = {
  new: FsrsState.New,
  learning: FsrsState.Learning,
  review: FsrsState.Review,
  relearning: FsrsState.Relearning,
};

// `Grade` excludes `Rating.Manual` (which we never use). Typing the map this
// way means scheduler.next() — which only accepts Grade — sees the right
// type without a cast.
const RATING_TO_FSRS: Record<Rating, Grade> = {
  1: FsrsRating.Again,
  2: FsrsRating.Hard,
  3: FsrsRating.Good,
  4: FsrsRating.Easy,
};

function toFsrsCard(prev: CardStateRow, now: Date): FsrsCard {
  const lastReview = prev.lastReviewAt ?? undefined;
  const elapsedDays = lastReview
    ? Math.max(
        0,
        (now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24),
      )
    : 0;
  return {
    due: prev.dueAt,
    stability: prev.stability,
    difficulty: prev.difficulty,
    elapsed_days: elapsedDays,
    scheduled_days: 0,
    reps: prev.reps,
    lapses: prev.lapses,
    state: STATE_FROM_DB[prev.state],
    last_review: lastReview,
  };
}

function fromFsrsCard(card: FsrsCard, now: Date): CardStateRow {
  return {
    stability: card.stability,
    difficulty: card.difficulty,
    dueAt: new Date(card.due),
    reps: card.reps,
    lapses: card.lapses,
    lastReviewAt: card.last_review ? new Date(card.last_review) : now,
    state: STATE_TO_DB[card.state],
  };
}

const scheduler = fsrs();

/**
 * Compute the next FSRS state given a previous state (or null for a card the
 * user has never touched) and a user rating. Pure: returns a fresh object,
 * never mutates `prev`.
 */
export function reviewCard(
  prev: CardStateRow | null,
  rating: Rating,
  now: Date = new Date(),
): CardStateRow {
  const card: FsrsCard = prev ? toFsrsCard(prev, now) : createEmptyCard(now);
  const result = scheduler.next(card, now, RATING_TO_FSRS[rating]);
  return fromFsrsCard(result.card, now);
}

/** Returns a fresh "new card" row for a card the user is about to encounter. */
export function newCardState(now: Date = new Date()): CardStateRow {
  return fromFsrsCard(createEmptyCard(now), now);
}
