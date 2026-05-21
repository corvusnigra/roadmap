"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  SandpackCodeEditor,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { CheckCircle2, Play, XCircle } from "lucide-react";
import { toast } from "sonner";

import { recordPracticeCorrect } from "@/app/roles/[slug]/nodes/[nodeSlug]/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EXERCISE_GLOBALS_JS } from "@/lib/sandpack/globals";
import { ExerciseMessageSchema, type ExerciseResult } from "@/lib/sandpack/protocol";

export interface CodeExerciseProps {
  roleSlug: string;
  nodeSlug: string;
  /** Server-action key: e.g. `code:0`. Used only for event-logging payloads. */
  itemKey: string;
  /** Stable integer used in test IDs (data-testid="code-exercise-<index>"). */
  index: number;
  prompt: string;
  starterCode: string;
  testsCode: string;
  language: "html" | "css" | "js" | "ts";
  /** Fires once when the user first passes this exercise. */
  onPass?: () => void;
}

type Verdict =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "pass"; message?: string }
  | { kind: "fail"; message?: string }
  | { kind: "timeout" };

const TEST_TIMEOUT_MS = 5_000;

/**
 * Inner UI — must be rendered inside <SandpackProvider> so useSandpack works.
 */
function ExerciseRunner({
  roleSlug,
  nodeSlug,
  itemKey,
  index,
  onPass,
}: Pick<
  CodeExerciseProps,
  "roleSlug" | "nodeSlug" | "itemKey" | "index" | "onPass"
>) {
  const { sandpack } = useSandpack();
  const [verdict, setVerdict] = useState<Verdict>({ kind: "idle" });
  const [hasPassedOnce, setHasPassedOnce] = useState(false);
  // Side-effect guard, not display state — keep out of useState so we don't
  // call recordPracticeCorrect twice under StrictMode double-render.
  const passReportedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, startTransition] = useTransition();

  // Listen for postMessage from the sandbox. Filter strictly via zod so any
  // unrelated chatter (browser extensions, other libs) is ignored.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const parsed = ExerciseMessageSchema.safeParse(e.data);
      if (!parsed.success) return;
      if (parsed.data.kind === "result") {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        const result: ExerciseResult = parsed.data;
        setVerdict({
          kind: result.ok ? "pass" : "fail",
          message: result.message,
        });
        if (result.ok && !passReportedRef.current) {
          passReportedRef.current = true;
          setHasPassedOnce(true);
          startTransition(async () => {
            try {
              await recordPracticeCorrect({ roleSlug, nodeSlug, itemKey });
              onPass?.();
              toast.success("Упражнение сдано", {
                description: result.message ?? "Все проверки прошли.",
              });
            } catch {
              /* swallow — UI already shows pass */
            }
          });
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [roleSlug, nodeSlug, itemKey, onPass]);

  const runTests = useCallback(() => {
    setVerdict({ kind: "running" });
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setVerdict({ kind: "timeout" });
    }, TEST_TIMEOUT_MS);
    // Sandpack 2.x exposes runSandpack() to restart the preview iframe; the
    // refresh() helper that used to live on `sandpack` was removed.
    void sandpack.runSandpack();
  }, [sandpack]);

  return (
    <div className="space-y-3 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          size="sm"
          variant="default"
          onClick={runTests}
          disabled={verdict.kind === "running" || pending}
          data-testid={`code-exercise-${index}-run`}
        >
          <Play className="mr-1 h-3.5 w-3.5" />
          {verdict.kind === "running" ? "Выполняется…" : "Запустить тесты"}
        </Button>
        {hasPassedOnce ? (
          <Badge
            variant="success"
            data-testid={`code-exercise-${index}-passed-badge`}
          >
            <CheckCircle2 className="mr-1 h-3 w-3" /> Сдано
          </Badge>
        ) : null}
      </div>

      {verdict.kind === "pass" ? (
        <div
          className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300"
          data-testid={`code-exercise-${index}-verdict-pass`}
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{verdict.message ?? "Все тесты пройдены."}</p>
        </div>
      ) : null}

      {verdict.kind === "fail" ? (
        <div
          className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-300"
          data-testid={`code-exercise-${index}-verdict-fail`}
        >
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{verdict.message ?? "Тесты не пройдены."}</p>
        </div>
      ) : null}

      {verdict.kind === "timeout" ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-300">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Тесты не прислали результат за {TEST_TIMEOUT_MS / 1000} с.
            Убедитесь, что файл с тестами вызывает <code>__report()</code>.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function CodeExercise({
  roleSlug,
  nodeSlug,
  itemKey,
  index,
  prompt,
  starterCode,
  testsCode,
  language,
  onPass,
}: CodeExerciseProps) {
  const visibleFileName = language === "html" ? "/index.html" : `/index.${language}`;
  const files: Record<string, { code: string; hidden?: boolean }> = {
    [visibleFileName]: { code: starterCode },
    "/globals.js": { code: EXERCISE_GLOBALS_JS, hidden: true },
  };
  if (testsCode) {
    files["/tests.js"] = { code: testsCode, hidden: true };
  }

  return (
    <article
      className="space-y-2 rounded-lg border bg-card p-4"
      data-testid={`code-exercise-${index}`}
    >
      <p className="text-sm font-medium leading-snug">
        {index + 1}. {prompt}
      </p>
      <SandpackProvider
        template="static"
        files={files}
        options={{
          activeFile: visibleFileName,
          visibleFiles: [visibleFileName],
          recompileMode: "delayed",
        }}
      >
        <SandpackLayout>
          <SandpackCodeEditor showLineNumbers showInlineErrors closableTabs={false} />
          <SandpackPreview showOpenInCodeSandbox={false} showRefreshButton={false} />
        </SandpackLayout>
        <ExerciseRunner
          roleSlug={roleSlug}
          nodeSlug={nodeSlug}
          itemKey={itemKey}
          index={index}
          onPass={onPass}
        />
      </SandpackProvider>
    </article>
  );
}
