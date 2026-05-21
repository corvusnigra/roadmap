import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type CalloutType = "tip" | "warn" | "note";

interface CalloutProps {
  type?: CalloutType;
  label?: string;
  children: ReactNode;
}

const VARIANTS: Record<
  CalloutType,
  { container: string; label: string; defaultLabel: string }
> = {
  tip: {
    container: "border-l-prose-accent bg-prose-accent-soft",
    label: "text-prose-accent",
    defaultLabel: "На практике",
  },
  warn: {
    container: "border-l-prose-warn bg-prose-warn-soft",
    label: "text-prose-warn",
    defaultLabel: "Внимание",
  },
  note: {
    container: "border-l-rule bg-paper",
    label: "text-ink-muted",
    defaultLabel: "Замечание",
  },
};

/**
 * Editorial-style callout for theory MDX. Use sparingly — 1–2 per article
 * (a tip on application, a warning on a common trap). Three variants only;
 * any more and the reading loses contrast.
 *
 * <Callout type="tip" label="На практике">…</Callout>
 */
export function Callout({ type = "note", label, children }: CalloutProps) {
  const variant = VARIANTS[type];
  return (
    <aside
      className={cn(
        "my-7 rounded-r-md border-l-4 px-5 py-4",
        // Strip leading/trailing margins from inner prose paragraphs so the
        // callout box hugs its content rather than gaining extra padding.
        "[&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
        "[&_p]:my-2 [&_p]:font-serif [&_p]:text-[15px] [&_p]:leading-[1.65] [&_p]:text-ink",
        variant.container,
      )}
    >
      <p
        className={cn(
          "mb-2 font-mono text-[11px] uppercase tracking-[0.18em] font-medium",
          variant.label,
        )}
      >
        {label ?? variant.defaultLabel}
      </p>
      <div className="text-ink">{children}</div>
    </aside>
  );
}
