"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { submitMasteryQuiz } from "@/app/roles/[slug]/nodes/[nodeSlug]/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import type { PracticeMcq } from "@/lib/content/schema";

interface MasteryQuizProps {
  roleSlug: string;
  nodeSlug: string;
  pool: PracticeMcq[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPassed: () => void;
}

interface PreparedQuestion {
  prompt: string;
  explanation: string;
  /** options re-ordered for display */
  displayOptions: string[];
  /** index into displayOptions that's the correct answer */
  correctIndex: number;
}

const QUIZ_SIZE = 5;
const PASS_RATIO = 0.8;

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function prepareQuiz(pool: PracticeMcq[]): PreparedQuestion[] {
  const picked = shuffleInPlace([...pool]).slice(0, QUIZ_SIZE);
  return picked.map((q) => {
    const labeled = q.options.map((option, i) => ({
      option,
      correct: i === q.answerIndex,
    }));
    shuffleInPlace(labeled);
    const correctIndex = labeled.findIndex((l) => l.correct);
    return {
      prompt: q.prompt,
      explanation: q.explanation,
      displayOptions: labeled.map((l) => l.option),
      correctIndex,
    };
  });
}

export function MasteryQuiz({
  roleSlug,
  nodeSlug,
  pool,
  open,
  onOpenChange,
  onPassed,
}: MasteryQuizProps) {
  // Re-prepare the quiz whenever the dialog opens. `pool` identity is stable
  // across renders so the memoization just hangs on `open`.
  const questions = useMemo(
    () => (open ? prepareQuiz(pool) : []),
    [open, pool],
  );

  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [result, setResult] = useState<{ score: number; passed: boolean } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  // Reset answers + verdict every time we generate a fresh set of questions.
  useEffect(() => {
    setAnswers(Array(questions.length).fill(null));
    setResult(null);
  }, [questions]);

  const allAnswered =
    answers.length === questions.length &&
    answers.every((a) => typeof a === "number");

  const handleSubmit = () => {
    let score = 0;
    questions.forEach((q, i) => {
      if (answers[i] === q.correctIndex) score++;
    });
    const passed = score / questions.length >= PASS_RATIO;
    setResult({ score, passed });

    startTransition(async () => {
      try {
        await submitMasteryQuiz({
          roleSlug,
          nodeSlug,
          score,
          total: questions.length,
        });
        if (passed) onPassed();
      } catch {
        /* surfaced via result panel above */
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
        data-testid="mastery-quiz-dialog"
      >
        <DialogHeader>
          <DialogTitle>Итоговый тест</DialogTitle>
          <DialogDescription>
            Правильно ответьте на {Math.ceil(QUIZ_SIZE * PASS_RATIO)} из{" "}
            {QUIZ_SIZE} вопросов, чтобы открыть закрепление.
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-4">
          {questions.map((q, i) => (
            <li
              key={i}
              className="space-y-2 rounded-md border p-3"
              data-testid={`mastery-question-${i}`}
            >
              <p className="text-sm font-medium leading-snug">
                {i + 1}. {q.prompt}
              </p>
              <RadioGroup
                value={answers[i]?.toString() ?? ""}
                onValueChange={(v) => {
                  if (result) return;
                  setAnswers((prev) => {
                    const next = [...prev];
                    next[i] = Number(v);
                    return next;
                  });
                }}
                className="gap-2"
              >
                {q.displayOptions.map((opt, j) => {
                  const id = `mastery-${i}-${j}`;
                  return (
                    <div key={id} className="flex items-start gap-3">
                      <RadioGroupItem
                        id={id}
                        value={String(j)}
                        disabled={Boolean(result)}
                      />
                      <Label htmlFor={id} className="cursor-pointer leading-snug">
                        {opt}
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
            </li>
          ))}
        </ol>

        {result ? (
          <div
            className={
              result.passed
                ? "rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300"
                : "rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300"
            }
            data-testid="mastery-result"
            data-passed={result.passed ? "true" : "false"}
          >
            {result.passed
              ? `Сдано: ${result.score} из ${questions.length}. Теперь оцените карточку, чтобы закрепить освоение.`
              : `Результат: ${result.score} из ${questions.length}. Нужно не меньше ${Math.ceil(
                  questions.length * PASS_RATIO,
                )} — попробуйте снова, когда будете готовы.`}
          </div>
        ) : null}

        <DialogFooter>
          {result ? (
            <Button
              variant="default"
              onClick={() => onOpenChange(false)}
              data-testid="mastery-quiz-close"
            >
              Закрыть
            </Button>
          ) : (
            <Button
              disabled={!allAnswered || pending}
              onClick={handleSubmit}
              data-testid="mastery-quiz-submit"
            >
              Ответить
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
