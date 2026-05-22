"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ArrowLeft, Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Theory } from "@/components/learn/theory";
import { PracticeMcq } from "@/components/learn/practice-mcq";
import { CodeExercise } from "@/components/practice/code-exercise";
import { MasteryQuiz } from "@/components/learn/mastery-quiz";
import {
  Reinforcement,
  type ReinforcementCard,
} from "@/components/learn/reinforcement";
import { TutorPanel } from "@/components/tutor/tutor-panel";

import type {
  NodeFrontmatter,
  PracticeMcq as McqItem,
} from "@/lib/content/schema";
import type { TutorTurn } from "@/app/api/tutor/types";

export interface InitialProgress {
  status: "locked" | "in_progress" | "mastered";
  masteryScore: number | null;
  theoryRead: boolean;
}

/**
 * Pre-loaded exercise files for a single `kind: 'code'` practice item.
 * `practiceIndex` is the position inside `frontmatter.practice[]` so we can
 * render the exercise in the right spot relative to MCQs.
 */
export interface LoadedCodeExercise {
  itemKey: string;
  practiceIndex: number;
  prompt: string;
  language: "html" | "css" | "js" | "ts";
  starterCode: string;
  testsCode: string;
}

export interface TocItem {
  id: string;
  text: string;
}

interface NodeViewProps {
  roleSlug: string;
  frontmatter: NodeFrontmatter;
  initialProgress: InitialProgress;
  theoryContent: ReactNode;
  tocItems: TocItem[];
  reinforcementCards: ReinforcementCard[];
  codeExercises: LoadedCodeExercise[];
  tutorHistory: TutorTurn[];
}

export function NodeView({
  roleSlug,
  frontmatter,
  initialProgress,
  theoryContent,
  tocItems,
  reinforcementCards,
  codeExercises,
  tutorHistory,
}: NodeViewProps) {
  const [status, setStatus] = useState(initialProgress.status);
  const [correctMcqs, setCorrectMcqs] = useState<Set<string>>(new Set());
  const [passedCodeKeys, setPassedCodeKeys] = useState<Set<string>>(new Set());
  const [masteryPassed, setMasteryPassed] = useState(false);
  const [masteryOpen, setMasteryOpen] = useState(false);

  const mcqItems = frontmatter.practice.filter(
    (item): item is McqItem => item.kind === "mcq",
  );

  const allMcqsCorrect =
    mcqItems.length === 0 ||
    mcqItems.every((_, i) => correctMcqs.has(`mcq:${i}`));

  const allCodeExercisesPassed =
    codeExercises.length === 0 ||
    codeExercises.every((ex) => passedCodeKeys.has(ex.itemKey));

  const masteryReady =
    allMcqsCorrect &&
    allCodeExercisesPassed &&
    (frontmatter.masteryQuiz?.length ?? 0) >= 5;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8">
      <nav className="text-xs font-mono uppercase tracking-[0.18em]">
        <Link
          href={`/roles/${roleSlug}` as `/roles/${string}`}
          className="inline-flex items-center gap-1.5 text-ink-muted hover:text-prose-accent transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> Назад к карте
        </Link>
      </nav>

      <header className="space-y-6 border-b border-rule pb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-4">
            <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.08] text-ink">
              {frontmatter.title}
            </h1>
            <p className="font-serif text-lg leading-[1.55] text-ink-muted max-w-[58ch]">
              {frontmatter.summary}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono uppercase tracking-[0.18em] text-ink-muted">
              <span>~{frontmatter.estimatedMinutes} мин</span>
              <span aria-hidden className="text-rule">·</span>
              <Badge
                variant={
                  status === "mastered"
                    ? "success"
                    : status === "in_progress"
                      ? "secondary"
                      : "muted"
                }
                className="rounded-sm font-mono text-[10px] tracking-[0.18em] uppercase"
                data-testid="node-status-badge"
              >
                {status === "mastered" ? (
                  <>
                    <Check className="mr-1 h-3 w-3" /> Освоено
                  </>
                ) : status === "in_progress" ? (
                  "В процессе"
                ) : (
                  "Доступно"
                )}
              </Badge>
            </div>
          </div>
          <TutorPanel
            roleSlug={roleSlug}
            nodeSlug={frontmatter.slug}
            nodeTitle={frontmatter.title}
            initialHistory={tutorHistory}
          />
        </div>
      </header>

      <Tabs defaultValue="theory" className="space-y-6">
        <TabsList>
          <TabsTrigger value="theory" data-testid="tab-theory">
            Теория
          </TabsTrigger>
          <TabsTrigger value="practice" data-testid="tab-practice">
            Практика
          </TabsTrigger>
          <TabsTrigger value="reinforcement" data-testid="tab-reinforcement">
            Закрепление
          </TabsTrigger>
        </TabsList>

        <TabsContent value="theory">
          <Theory
            roleSlug={roleSlug}
            nodeSlug={frontmatter.slug}
            initiallyRead={initialProgress.theoryRead}
            learningOutcomes={frontmatter.learningOutcomes}
            tocItems={tocItems}
          >
            {theoryContent}
          </Theory>
        </TabsContent>

        <TabsContent value="practice" className="space-y-4">
          {mcqItems.length === 0 && codeExercises.length === 0 ? (
            <p className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
              В этом узле пока нет заданий.
            </p>
          ) : (
            // Один одинокий MCQ без code-упражнений (типично для
            // рефлексивных узлов вроде Levenchuk-стека) — это не «тест»,
            // а быстрая разминка перед итоговым тестом. Без kicker'а
            // студент думает, что это и есть проверка.
            <p className="text-xs font-mono uppercase tracking-[0.18em] text-prose-accent">
              {mcqItems.length === 1 && codeExercises.length === 0
                ? "Разминка перед итоговым тестом"
                : "Тренировочные задания — открывают итоговый тест"}
            </p>
          )}

          {mcqItems.map((item, i) => (
            <PracticeMcq
              key={`mcq-${i}`}
              roleSlug={roleSlug}
              nodeSlug={frontmatter.slug}
              itemKey={`mcq:${i}`}
              index={i}
              item={item}
              alreadyCorrect={correctMcqs.has(`mcq:${i}`)}
              onCorrect={() =>
                setCorrectMcqs((prev) => new Set(prev).add(`mcq:${i}`))
              }
            />
          ))}

          {codeExercises.map((ex) => (
            <CodeExercise
              key={ex.itemKey}
              roleSlug={roleSlug}
              nodeSlug={frontmatter.slug}
              itemKey={ex.itemKey}
              index={ex.practiceIndex}
              prompt={ex.prompt}
              starterCode={ex.starterCode}
              testsCode={ex.testsCode}
              language={ex.language}
              onPass={() =>
                setPassedCodeKeys((prev) => new Set(prev).add(ex.itemKey))
              }
            />
          ))}

          {frontmatter.masteryQuiz && frontmatter.masteryQuiz.length >= 5 ? (
            <div className="flex items-center justify-between rounded-md border bg-muted/40 p-4">
              <div>
                <p className="text-sm font-medium">Итоговый тест</p>
                <p className="text-xs text-muted-foreground">
                  {masteryReady
                    ? "Все задания выполнены. Сдайте 4 из 5, чтобы открыть закрепление."
                    : codeExercises.length > 0 && !allCodeExercisesPassed
                      ? "Сдайте все упражнения, чтобы открыть тест."
                      : "Ответьте правильно на все вопросы, чтобы открыть тест."}
                </p>
              </div>
              <Button
                disabled={!masteryReady}
                onClick={() => setMasteryOpen(true)}
                data-testid="open-mastery-quiz"
              >
                Пройти тест
              </Button>
            </div>
          ) : null}

          <MasteryQuiz
            roleSlug={roleSlug}
            nodeSlug={frontmatter.slug}
            pool={frontmatter.masteryQuiz ?? []}
            open={masteryOpen}
            onOpenChange={setMasteryOpen}
            onPassed={() => setMasteryPassed(true)}
          />
        </TabsContent>

        <TabsContent value="reinforcement">
          <Reinforcement
            cards={reinforcementCards}
            enabled={
              masteryPassed ||
              status === "mastered" ||
              (initialProgress.masteryScore ?? 0) >= 0.8
            }
            onMastered={() => setStatus("mastered")}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
