"use client";

import { useState, useTransition } from "react";

import { gradeReinforcementCard } from "@/app/roles/[slug]/nodes/[nodeSlug]/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { FlashcardInput } from "@/lib/content/schema";

interface ReinforcementProps {
  roleSlug: string;
  nodeSlug: string;
  cards: FlashcardInput[];
  /** When true, grading any card calls onMastered() so the page reflects the status flip. */
  enabled: boolean;
  onGraded: () => void;
}

const RATINGS = [
  { label: "Again", value: 1, hotkey: "1" },
  { label: "Hard", value: 2, hotkey: "2" },
  { label: "Good", value: 3, hotkey: "3" },
  { label: "Easy", value: 4, hotkey: "4" },
] as const;

export function Reinforcement({
  roleSlug,
  nodeSlug,
  cards,
  enabled,
  onGraded,
}: ReinforcementProps) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [gradedCount, setGradedCount] = useState(0);

  if (cards.length === 0) {
    return (
      <p className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
        This node has no flashcards yet.
      </p>
    );
  }

  if (!enabled) {
    return (
      <div className="rounded-md border bg-card p-4 text-sm">
        <p className="font-medium">Reinforcement is gated</p>
        <p className="mt-1 text-muted-foreground">
          Pass the mastery quiz to unlock flashcard review. Phase 5 will wire
          these up to a real FSRS scheduler — for now grading a single card is
          enough to flip the node to mastered.
        </p>
      </div>
    );
  }

  const card = cards[index % cards.length];
  if (!card) return null;

  const handleGrade = (rating: number) => {
    startTransition(async () => {
      try {
        await gradeReinforcementCard({
          roleSlug,
          nodeSlug,
          cardKey: `${nodeSlug}:${index % cards.length}`,
          rating,
        });
        setGradedCount((n) => n + 1);
        onGraded();
        setRevealed(false);
        setIndex((i) => i + 1);
      } catch {
        /* best-effort UI */
      }
    });
  };

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Card {((index % cards.length) + 1)} of {cards.length}
        </span>
        <span data-testid="reinforcement-graded-count">
          Graded this session: {gradedCount}
        </span>
      </header>

      <article
        className="space-y-3 rounded-lg border bg-card p-4"
        data-testid="reinforcement-card"
      >
        <p className="text-sm font-medium leading-snug">{card.front}</p>
        {revealed ? (
          <p className="rounded-md border-l-2 border-primary bg-primary/5 p-3 text-sm">
            {card.back}
          </p>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRevealed(true)}
            data-testid="reinforcement-show-answer"
          >
            Show answer
          </Button>
        )}
      </article>

      <div className="grid grid-cols-4 gap-2">
        {RATINGS.map((r) => (
          <Button
            key={r.value}
            variant="outline"
            disabled={!revealed || pending}
            onClick={() => handleGrade(r.value)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 py-3",
              r.value === 1 && "hover:border-red-400",
              r.value === 2 && "hover:border-orange-400",
              r.value === 3 && "hover:border-emerald-400",
              r.value === 4 && "hover:border-sky-400",
            )}
            data-testid={`reinforcement-grade-${r.label.toLowerCase()}`}
          >
            <span className="text-sm font-medium">{r.label}</span>
            <span className="text-[10px] text-muted-foreground">{r.hotkey}</span>
          </Button>
        ))}
      </div>
    </section>
  );
}
