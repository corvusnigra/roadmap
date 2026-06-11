"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

import { gradePracticeMcq } from "@/app/roles/[slug]/nodes/[nodeSlug]/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

// Клиент получает MCQ без answerIndex/explanation.
interface SafeMcqItem {
  kind: "mcq";
  prompt: string;
  options: string[];
}

interface PracticeMcqProps {
  roleSlug: string;
  nodeSlug: string;
  itemKey: string;
  index: number;
  item: SafeMcqItem;
  onCorrect: () => void;
  alreadyCorrect: boolean;
}

type Verdict = "unanswered" | "correct" | "incorrect";

export function PracticeMcq({
  roleSlug,
  nodeSlug,
  itemKey,
  index,
  item,
  onCorrect,
  alreadyCorrect,
}: PracticeMcqProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<Verdict>(
    alreadyCorrect ? "correct" : "unanswered",
  );
  // explanation приходит с сервера только после правильного ответа.
  const [explanation, setExplanation] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleCheck = () => {
    if (selected === null || pending) return;
    const chosenIndex = Number(selected);

    startTransition(async () => {
      try {
        // Fix #1: проверяем на сервере, answerIndex не хранится на клиенте.
        const result = await gradePracticeMcq({
          roleSlug,
          nodeSlug,
          itemKey,
          chosenIndex,
        });
        if (result.correct) {
          setVerdict("correct");
          setExplanation(result.explanation);
          onCorrect();
        } else {
          setVerdict("incorrect");
        }
      } catch {
        // Ошибка сети / сервера — показываем neutral "попробуй ещё раз".
        setVerdict("incorrect");
      }
    });
  };

  const isLocked = verdict === "correct";

  return (
    <article
      className="space-y-3 rounded-lg border bg-card p-4"
      data-testid={`practice-mcq-${index}`}
      data-correct={verdict === "correct" ? "true" : "false"}
    >
      <header className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-snug">
          {index + 1}. {item.prompt}
        </p>
        {verdict === "correct" ? (
          <CheckCircle2
            className="h-5 w-5 text-emerald-500"
            aria-label="Правильно"
          />
        ) : null}
      </header>

      <RadioGroup
        value={selected ?? ""}
        onValueChange={(v) => {
          if (isLocked) return;
          setSelected(v);
          if (verdict === "incorrect") setVerdict("unanswered");
        }}
        className="gap-2"
      >
        {item.options.map((option, i) => {
          const id = `mcq-${index}-${i}`;
          return (
            <div
              key={id}
              className={cn(
                "flex items-start gap-3 rounded-md border p-3",
                selected === String(i) && verdict === "correct"
                  ? "border-emerald-500/50 bg-emerald-500/5"
                  : selected === String(i) && verdict === "incorrect"
                    ? "border-red-500/50 bg-red-500/5"
                    : "",
              )}
            >
              <RadioGroupItem
                id={id}
                value={String(i)}
                disabled={isLocked}
              />
              <Label htmlFor={id} className="cursor-pointer leading-snug">
                {option}
              </Label>
            </div>
          );
        })}
      </RadioGroup>

      {verdict === "unanswered" ? (
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={selected === null || pending}
            onClick={handleCheck}
            data-testid={`practice-mcq-${index}-check`}
          >
            {pending ? "Проверяем…" : "Проверить"}
          </Button>
        </div>
      ) : null}

      {verdict === "incorrect" ? (
        <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p>Не совсем — попробуйте ещё раз.</p>
        </div>
      ) : null}

      {verdict === "correct" ? (
        <div className="space-y-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
          <p className="font-medium text-emerald-700 dark:text-emerald-300">
            Правильно
          </p>
          {explanation ? (
            <p className="text-muted-foreground">{explanation}</p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
