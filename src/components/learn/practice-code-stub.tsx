"use client";

import { Code2 } from "lucide-react";

import type { PracticeCode } from "@/lib/content/schema";

interface PracticeCodeStubProps {
  index: number;
  item: PracticeCode;
}

/**
 * Stub for code exercises until Phase 6 wires up Sandpack. Renders the prompt
 * and the file paths the author specified so reviewers can verify the content
 * is wired up.
 */
export function PracticeCodeStub({ index, item }: PracticeCodeStubProps) {
  return (
    <article
      className="space-y-2 rounded-lg border border-dashed border-muted bg-card p-4"
      data-testid={`practice-code-${index}`}
    >
      <header className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
        <Code2 className="h-3.5 w-3.5" />
        <span>Code exercise · language: {item.language}</span>
        <span className="rounded bg-muted px-1.5 py-0.5">Coming in Phase 6</span>
      </header>
      <p className="text-sm font-medium leading-snug">
        {index + 1}. {item.prompt}
      </p>
      <dl className="grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-3">
        <div>
          <dt className="font-medium">Starter</dt>
          <dd className="font-mono">{item.starterFile}</dd>
        </div>
        <div>
          <dt className="font-medium">Solution</dt>
          <dd className="font-mono">{item.solutionFile}</dd>
        </div>
        {item.testsFile ? (
          <div>
            <dt className="font-medium">Tests</dt>
            <dd className="font-mono">{item.testsFile}</dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}
