"use client";

import { useEffect, useState, useTransition } from "react";

import { gradeCard } from "@/app/review/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ReinforcementCard {
  cardId: string;
  prompt: string;
  answerMarkdown: string;
}

interface ReinforcementProps {
  cards: ReinforcementCard[];
  /** Whether the user is past the mastery gate and can grade cards. */
  enabled: boolean;
  /** Called when the server reports the node flipped to `mastered`. */
  onMastered: () => void;
}

const RATINGS = [
  { label: "Again", value: 1, hotkey: "1" },
  { label: "Hard", value: 2, hotkey: "2" },
  { label: "Good", value: 3, hotkey: "3" },
  { label: "Easy", value: 4, hotkey: "4" },
] as const;

export function Reinforcement({
  cards,
  enabled,
  onMastered,
}: ReinforcementProps) {
  // Local queue lets us optimistically remove a card after grading without
  // waiting for a server-side revalidate. Re-derive from `cards` prop when it
  // changes (page revalidated, new server data).
  const [queue, setQueue] = useState(cards);
  useEffect(() => setQueue(cards), [cards]);

  const [revealed, setRevealed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [gradedCount, setGradedCount] = useState(0);

  if (!enabled) {
    return (
      <div className="rounded-md border bg-card p-4 text-sm">
        <p className="font-medium">Reinforcement is gated</p>
        <p className="mt-1 text-muted-foreground">
          Pass the mastery quiz to unlock flashcard review. Grading one card
          flips the node to mastered; subsequent grades go through the FSRS
          scheduler.
        </p>
      </div>
    );
  }

  const card = queue[0];

  if (!card) {
    return (
      <div
        className="rounded-md border bg-card p-4 text-sm text-muted-foreground"
        data-testid="reinforcement-empty"
      >
        {gradedCount > 0
          ? "All cards graded for this node — they'll resurface when the FSRS scheduler says so."
          : "No flashcards due for this node right now."}
      </div>
    );
  }

  const handleGrade = (rating: 1 | 2 | 3 | 4) => {
    startTransition(async () => {
      try {
        const result = await gradeCard({ cardId: card.cardId, rating });
        setGradedCount((n) => n + 1);
        if (result.mastered) onMastered();
        setRevealed(false);
        setQueue((q) => q.slice(1));
      } catch {
        /* best-effort UI */
      }
    });
  };

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {queue.length} card{queue.length === 1 ? "" : "s"} due
        </span>
        <span data-testid="reinforcement-graded-count">
          Graded this session: {gradedCount}
        </span>
      </header>

      <article
        className="space-y-3 rounded-lg border bg-card p-4"
        data-testid="reinforcement-card"
        data-card-id={card.cardId}
      >
        <p className="text-sm font-medium leading-snug">{card.prompt}</p>
        {revealed ? (
          <p className="rounded-md border-l-2 border-primary bg-primary/5 p-3 text-sm">
            {card.answerMarkdown}
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
