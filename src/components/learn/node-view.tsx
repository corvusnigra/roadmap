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

import type {
  NodeFrontmatter,
  PracticeMcq as McqItem,
} from "@/lib/content/schema";

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

interface NodeViewProps {
  roleSlug: string;
  frontmatter: NodeFrontmatter;
  initialProgress: InitialProgress;
  theoryContent: ReactNode;
  reinforcementCards: ReinforcementCard[];
  codeExercises: LoadedCodeExercise[];
}

export function NodeView({
  roleSlug,
  frontmatter,
  initialProgress,
  theoryContent,
  reinforcementCards,
  codeExercises,
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
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6">
      <nav className="text-sm">
        <Link
          href={`/roles/${roleSlug}` as `/roles/${string}`}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to roadmap
        </Link>
      </nav>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {frontmatter.title}
          </h1>
          <Badge
            variant={
              status === "mastered"
                ? "success"
                : status === "in_progress"
                  ? "secondary"
                  : "muted"
            }
            data-testid="node-status-badge"
          >
            {status === "mastered" ? (
              <>
                <Check className="mr-1 h-3 w-3" /> Mastered
              </>
            ) : status === "in_progress" ? (
              "In progress"
            ) : (
              "Available"
            )}
          </Badge>
        </div>
        <p className="text-muted-foreground">{frontmatter.summary}</p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>~{frontmatter.estimatedMinutes} min</span>
          {frontmatter.learningOutcomes.length > 0 ? (
            <details className="group">
              <summary className="cursor-pointer">
                {frontmatter.learningOutcomes.length} learning outcomes
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {frontmatter.learningOutcomes.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </header>

      <Tabs defaultValue="theory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="theory" data-testid="tab-theory">
            Theory
          </TabsTrigger>
          <TabsTrigger value="practice" data-testid="tab-practice">
            Practice
          </TabsTrigger>
          <TabsTrigger value="reinforcement" data-testid="tab-reinforcement">
            Reinforcement
          </TabsTrigger>
        </TabsList>

        <TabsContent value="theory">
          <Theory
            roleSlug={roleSlug}
            nodeSlug={frontmatter.slug}
            initiallyRead={initialProgress.theoryRead}
          >
            {theoryContent}
          </Theory>
        </TabsContent>

        <TabsContent value="practice" className="space-y-4">
          {mcqItems.length === 0 && codeExercises.length === 0 ? (
            <p className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
              This node has no practice items yet.
            </p>
          ) : null}

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
                <p className="text-sm font-medium">Take the mastery quiz</p>
                <p className="text-xs text-muted-foreground">
                  {masteryReady
                    ? "All practice items done. Pass 4 of 5 to clear the gate."
                    : codeExercises.length > 0 && !allCodeExercisesPassed
                      ? "Pass every code exercise to unlock."
                      : "Answer every practice MCQ correctly to unlock."}
                </p>
              </div>
              <Button
                disabled={!masteryReady}
                onClick={() => setMasteryOpen(true)}
                data-testid="open-mastery-quiz"
              >
                Take mastery quiz
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
