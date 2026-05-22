"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { markTheoryRead } from "@/app/roles/[slug]/nodes/[nodeSlug]/actions";
import { Button } from "@/components/ui/button";
import { SelectionTutor } from "@/components/learn/selection-tutor";
import type { TocItem } from "@/components/learn/node-view";

interface TheoryProps {
  roleSlug: string;
  nodeSlug: string;
  initiallyRead: boolean;
  learningOutcomes: string[];
  tocItems: TocItem[];
  children: ReactNode;
}

export function Theory({
  roleSlug,
  nodeSlug,
  initiallyRead,
  learningOutcomes,
  tocItems,
  children,
}: TheoryProps) {
  const [read, setRead] = useState(initiallyRead);
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,1fr)_220px] xl:gap-14">
      <article className="prose-article max-w-[68ch]">
        {/* Pinned outcomes card. Editorial-style: kicker label + numbered
            list with monospace counter, no fill — sits like a syllabus
            sidebar at the top of the reading. */}
        {learningOutcomes.length > 0 ? (
          <aside className="not-prose mb-10 rounded-lg border border-rule bg-paper p-6">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-prose-accent font-medium">
              Что вы будете уметь
            </p>
            <ol className="space-y-3">
              {learningOutcomes.map((o, i) => (
                <li key={i} className="flex gap-4">
                  <span
                    className="font-mono text-sm text-prose-accent tabular-nums shrink-0 mt-0.5"
                    aria-hidden
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-serif text-[15px] leading-relaxed text-ink">
                    {o}
                  </span>
                </li>
              ))}
            </ol>
          </aside>
        ) : null}

        {/* Inline-tutor: оборачиваем только тело статьи. Выделенный
            текст внутри вызывает плавающую кнопку «Объяснить» — server-action
            explainConcept лезет в общий кэш по (nodeId, concept), при miss
            делает RAG+LLM и кэширует. Outcomes-карточку и mark-read кнопку
            не оборачиваем — там нечего выделять. */}
        <SelectionTutor roleSlug={roleSlug} nodeSlug={nodeSlug}>
          {children}
        </SelectionTutor>

        <div className="not-prose mt-12 flex items-center justify-end border-t border-rule pt-6">
          <Button
            variant={read ? "secondary" : "default"}
            disabled={pending || read}
            onClick={() =>
              startTransition(async () => {
                try {
                  await markTheoryRead({ roleSlug, nodeSlug });
                  setRead(true);
                  toast.success("Теория отмечена прочитанной");
                } catch (err) {
                  toast.error("Не удалось отметить", {
                    description: err instanceof Error ? err.message : String(err),
                  });
                }
              })
            }
            data-testid="theory-mark-read"
          >
            {read ? (
              <>
                <Check className="mr-1 h-4 w-4" /> Прочитано
              </>
            ) : (
              "Отметить прочитанным"
            )}
          </Button>
        </div>
      </article>

      {tocItems.length > 0 ? (
        <nav
          className="hidden xl:block sticky top-8 self-start"
          aria-label="Содержание статьи"
        >
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-prose-accent font-medium">
            На этой странице
          </p>
          <ol className="space-y-0.5 text-sm">
            {tocItems.map(({ id, text }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="block border-l-2 border-rule pl-3 py-1.5 text-ink-muted hover:text-ink hover:border-prose-accent transition-colors font-serif text-[14px] leading-snug"
                >
                  {text}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
    </div>
  );
}
