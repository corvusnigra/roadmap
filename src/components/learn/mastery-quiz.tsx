"use client";

import { useEffect, useRef, useState, useTransition } from "react";

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

// Клиент получает MCQ без answerIndex/explanation (страница их вырезает).
// Тип отражает это.
export interface SafeMcqItem {
  kind: "mcq";
  prompt: string;
  options: string[];
}

interface MasteryQuizProps {
  roleSlug: string;
  nodeSlug: string;
  pool: SafeMcqItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPassed: () => void;
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

/**
 * Перемешанный вопрос для отображения. Хранит originalIndex — индекс вопроса
 * в ОРИГИНАЛЬНОМ пуле — и optionOrder — индексы опций в оригинальном массиве.
 * Это нужно, чтобы при отправке передавать серверу оригинальные позиции, по
 * которым он проверяет ответы.
 */
interface ShuffledQuestion {
  originalIndex: number;
  prompt: string;
  /** Опции в порядке показа. */
  displayOptions: string[];
  /**
   * Для каждой displayOption — её оригинальный индекс в item.options.
   * Нужно при отправке: answers[i].chosenIndex = originalOptionIndices[chosen].
   */
  originalOptionIndices: number[];
}

function buildShuffledQuiz(pool: SafeMcqItem[]): ShuffledQuestion[] {
  // Перемешиваем пул и берём QUIZ_SIZE вопросов.
  const indices = shuffleInPlace(pool.map((_, i) => i)).slice(0, QUIZ_SIZE);
  return indices.map((originalIndex) => {
    const item = pool[originalIndex]!;
    // Перемешиваем опции, сохраняя исходные индексы.
    const optionPairs = item.options.map((opt, i) => ({ opt, origIdx: i }));
    shuffleInPlace(optionPairs);
    return {
      originalIndex,
      prompt: item.prompt,
      displayOptions: optionPairs.map((p) => p.opt),
      originalOptionIndices: optionPairs.map((p) => p.origIdx),
    };
  });
}

interface ServerResult {
  passed: boolean;
  score: number;
  total: number;
  details: Array<{
    questionIndex: number;
    correct: boolean;
    correctIndex: number;
    explanation: string;
  }>;
}

export function MasteryQuiz({
  roleSlug,
  nodeSlug,
  pool,
  open,
  onOpenChange,
  onPassed,
}: MasteryQuizProps) {
  // Fix: генерируем quiz в useState-инициализаторе (не useMemo), чтобы не было
  // рассинхрона между questions и answers при переоткрытии диалога.
  const [questions, setQuestions] = useState<ShuffledQuestion[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);

  // Результат приходит с сервера (не вычисляется на клиенте).
  const [serverResult, setServerResult] = useState<ServerResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Только один раз используем ref для отслеживания предыдущего open.
  const prevOpenRef = useRef(false);

  // Сбрасываем и перегенерируем quiz при каждом открытии диалога.
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      const q = buildShuffledQuiz(pool);
      setQuestions(q);
      setAnswers(Array(q.length).fill(null));
      setServerResult(null);
      setSubmitError(null);
    }
    prevOpenRef.current = open;
  }, [open, pool]);

  const allAnswered =
    answers.length === questions.length &&
    answers.length > 0 &&
    answers.every((a) => typeof a === "number");

  const handleSubmit = () => {
    if (!allAnswered || pending) return;

    // Собираем ответы с ОРИГИНАЛЬНЫМИ индексами вопросов и опций.
    const serverAnswers = questions.map((q, i) => ({
      questionIndex: q.originalIndex,
      // answers[i] — это индекс в displayOptions; переводим в оригинальный.
      chosenIndex: q.originalOptionIndices[answers[i] as number]!,
    }));

    setSubmitError(null);
    startTransition(async () => {
      try {
        const result = await submitMasteryQuiz({
          roleSlug,
          nodeSlug,
          answers: serverAnswers,
        });
        setServerResult(result);
        // Fix: onPassed вызывается только после подтверждения с сервера.
        if (result.passed) onPassed();
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Неизвестная ошибка сервера";
        setSubmitError(msg);
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
          {questions.map((q, i) => {
            // После получения серверного результата подсвечиваем ответы.
            const detail = serverResult?.details.find(
              (d) => d.questionIndex === q.originalIndex,
            );
            return (
              <li
                key={q.originalIndex}
                className="space-y-2 rounded-md border p-3"
                data-testid={`mastery-question-${i}`}
              >
                <p className="text-sm font-medium leading-snug">
                  {i + 1}. {q.prompt}
                </p>
                <RadioGroup
                  value={answers[i]?.toString() ?? ""}
                  onValueChange={(v) => {
                    if (serverResult) return;
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
                    // Вычисляем, какой оригинальный индекс у этой displayOption.
                    const origIdx = q.originalOptionIndices[j]!;
                    const isCorrectOrig = detail?.correctIndex === origIdx;
                    const isChosenDisplay = answers[i] === j;
                    return (
                      <div key={id} className="flex items-start gap-3">
                        <RadioGroupItem
                          id={id}
                          value={String(j)}
                          disabled={Boolean(serverResult)}
                        />
                        <Label
                          htmlFor={id}
                          className={
                            serverResult
                              ? isCorrectOrig
                                ? "cursor-default leading-snug text-emerald-700 dark:text-emerald-300"
                                : isChosenDisplay && !detail?.correct
                                  ? "cursor-default leading-snug text-red-600 dark:text-red-400"
                                  : "cursor-default leading-snug"
                              : "cursor-pointer leading-snug"
                          }
                        >
                          {opt}
                        </Label>
                      </div>
                    );
                  })}
                </RadioGroup>
                {serverResult && detail ? (
                  <p className="text-xs text-muted-foreground">
                    {detail.explanation}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>

        {serverResult ? (
          <div
            className={
              serverResult.passed
                ? "rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300"
                : "rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300"
            }
            data-testid="mastery-result"
            data-passed={serverResult.passed ? "true" : "false"}
          >
            {serverResult.passed
              ? `Сдано: ${serverResult.score} из ${serverResult.total}. Теперь оцените карточку, чтобы закрепить освоение.`
              : `Результат: ${serverResult.score} из ${serverResult.total}. Нужно не меньше ${Math.ceil(
                  serverResult.total * PASS_RATIO,
                )} — попробуйте снова, когда будете готовы.`}
          </div>
        ) : null}

        {/* Fix: показываем ошибку сервера с возможностью повтора. */}
        {submitError ? (
          <div
            className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300"
            data-testid="mastery-submit-error"
          >
            <p className="font-medium">Ошибка отправки</p>
            <p className="mt-1">{submitError}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={handleSubmit}
              disabled={pending}
              data-testid="mastery-quiz-retry"
            >
              Повторить
            </Button>
          </div>
        ) : null}

        <DialogFooter>
          {serverResult ? (
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
              {pending ? "Проверяем…" : "Ответить"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
