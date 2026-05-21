"use client";

import { useEffect, useState, useTransition } from "react";

import { gradeCard } from "@/app/review/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ReviewQueueItem {
  cardId: string;
  prompt: string;
  answerMarkdown: string;
  nodeSlug: string;
  nodeTitle: string;
}

interface ReviewQueueProps {
  items: ReviewQueueItem[];
}

const RATINGS = [
  { testKey: "again", label: "Снова", value: 1, key: "1" },
  { testKey: "hard", label: "Тяжело", value: 2, key: "2" },
  { testKey: "good", label: "Хорошо", value: 3, key: "3" },
  { testKey: "easy", label: "Легко", value: 4, key: "4" },
] as const;

export function ReviewQueue({ items }: ReviewQueueProps) {
  const [queue, setQueue] = useState(items);
  useEffect(() => setQueue(items), [items]);

  const [revealed, setRevealed] = useState(false);
  const [graded, setGraded] = useState(0);
  const [pending, startTransition] = useTransition();

  const current = queue[0];

  // Keyboard: Space reveals, 1–4 grade.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (!current) return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setRevealed(true);
        return;
      }
      if (revealed && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        const rating = Number(e.key) as 1 | 2 | 3 | 4;
        void doGrade(rating);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.cardId, revealed]);

  function doGrade(rating: 1 | 2 | 3 | 4) {
    if (!current) return;
    startTransition(async () => {
      try {
        await gradeCard({ cardId: current.cardId, rating });
        setGraded((n) => n + 1);
        setRevealed(false);
        setQueue((q) => q.slice(1));
      } catch {
        /* swallow — UI shows nothing changed */
      }
    });
  }

  if (!current) {
    return (
      <div
        className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground"
        data-testid="review-queue-empty"
      >
        <p className="text-base font-medium text-foreground">Нет карточек на повторение</p>
        <p className="mt-1">
          {graded > 0
            ? `Оценено за сессию: ${graded}. Возвращайтесь завтра.`
            : "Возвращайтесь завтра."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          в очереди: {queue.length} · оценено за сессию: {graded}
        </span>
        <Badge variant="muted" className="font-normal">
          {current.nodeTitle}
        </Badge>
      </div>

      <article
        className="space-y-4 rounded-lg border bg-card p-6"
        data-testid="review-card"
        data-card-id={current.cardId}
      >
        <p className="text-base font-medium leading-snug">{current.prompt}</p>
        {revealed ? (
          <p className="rounded-md border-l-2 border-primary bg-primary/5 p-3 text-sm">
            {current.answerMarkdown}
          </p>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRevealed(true)}
            data-testid="review-show-answer"
          >
            Показать ответ · Space
          </Button>
        )}
      </article>

      <div className="grid grid-cols-4 gap-2">
        {RATINGS.map((r) => (
          <Button
            key={r.value}
            variant="outline"
            disabled={!revealed || pending}
            onClick={() => doGrade(r.value)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 py-3",
              r.value === 1 && "hover:border-red-400",
              r.value === 2 && "hover:border-orange-400",
              r.value === 3 && "hover:border-emerald-400",
              r.value === 4 && "hover:border-sky-400",
            )}
            data-testid={`review-grade-${r.testKey}`}
          >
            <span className="text-sm font-medium">{r.label}</span>
            <span className="text-[10px] text-muted-foreground">{r.key}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
