import type {
  AnchorHTMLAttributes,
  HTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
} from "react";

import { Callout } from "@/components/learn/callout";
import { cn } from "@/lib/utils";

/**
 * URL-safe-ish slug that keeps Cyrillic intact. HTML5 ids allow Unicode,
 * so `#что-такое-агент` is valid and stable.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function nodeToText(node: ReactNode): string {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join("");
  if (typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    return props ? nodeToText(props.children) : "";
  }
  return "";
}

/**
 * Component overrides for MDXRemote. Together with the `.prose-article`
 * wrapper they produce the "editorial scholarly" look for theory text:
 * counter-numbered H2 sections, comfortable serif body, mono uppercase
 * labels for callouts and table headers.
 *
 * Inline `code` and block `pre > code` use the same `<code>` override —
 * the `pre` style strips its child's background/padding via descendant
 * selectors so block code inherits the dark slab look.
 */
export const mdxComponents = {
  h1: (props: HTMLAttributes<HTMLHeadingElement>) => (
    <h1
      {...props}
      className="font-serif text-3xl font-semibold tracking-tight mt-10 mb-4 text-ink"
    />
  ),
  h2: ({ children, ...rest }: HTMLAttributes<HTMLHeadingElement>) => {
    const id = slugify(nodeToText(children));
    return (
      <h2
        id={id}
        {...rest}
        className="font-serif text-[26px] font-semibold tracking-tight mt-14 mb-4 scroll-mt-24 text-ink"
      >
        {children}
      </h2>
    );
  },
  h3: ({ children, ...rest }: HTMLAttributes<HTMLHeadingElement>) => (
    <h3
      {...rest}
      className="font-serif text-[19px] font-semibold mt-8 mb-3 text-ink"
    >
      {children}
    </h3>
  ),
  p: (props: HTMLAttributes<HTMLParagraphElement>) => (
    <p
      {...props}
      className="my-4 font-serif text-[17px] leading-[1.7] text-ink"
    />
  ),
  ul: (props: HTMLAttributes<HTMLUListElement>) => (
    <ul
      {...props}
      className="my-4 list-disc pl-6 space-y-1.5 marker:text-prose-accent"
    />
  ),
  ol: (props: HTMLAttributes<HTMLOListElement>) => (
    <ol
      {...props}
      className="my-4 list-decimal pl-6 space-y-1.5 marker:text-prose-accent marker:font-mono marker:font-medium"
    />
  ),
  li: (props: HTMLAttributes<HTMLLIElement>) => (
    <li {...props} className="font-serif text-[17px] leading-[1.7] text-ink" />
  ),
  strong: (props: HTMLAttributes<HTMLElement>) => (
    <strong {...props} className="font-semibold text-ink" />
  ),
  em: (props: HTMLAttributes<HTMLElement>) => (
    <em {...props} className="italic" />
  ),
  blockquote: (props: HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      {...props}
      className="my-6 border-l-2 border-prose-accent pl-5 italic font-serif text-ink-muted"
    />
  ),
  hr: (props: HTMLAttributes<HTMLHRElement>) => (
    <hr {...props} className="my-10 border-rule" />
  ),
  a: ({ children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      {...rest}
      className="text-prose-accent underline underline-offset-[3px] decoration-prose-accent/40 hover:decoration-prose-accent transition-colors"
    >
      {children}
    </a>
  ),
  table: (props: TableHTMLAttributes<HTMLTableElement>) => (
    <div className="my-7 overflow-x-auto rounded-md border border-rule">
      <table
        {...props}
        className="w-full border-collapse text-[15px] font-serif"
      />
    </div>
  ),
  thead: (props: HTMLAttributes<HTMLTableSectionElement>) => (
    <thead {...props} className="bg-paper" />
  ),
  th: (props: HTMLAttributes<HTMLTableCellElement>) => (
    <th
      {...props}
      className="border-b border-rule px-4 py-3 text-left font-mono text-[11px] uppercase tracking-[0.18em] text-prose-accent font-medium align-bottom"
    />
  ),
  td: (props: HTMLAttributes<HTMLTableCellElement>) => (
    <td
      {...props}
      className="border-b border-rule/60 px-4 py-3 align-top font-serif text-[15px] leading-[1.6] text-ink last:border-b-0"
    />
  ),
  tr: (props: HTMLAttributes<HTMLTableRowElement>) => (
    <tr {...props} className="last:[&_td]:border-b-0" />
  ),
  code: ({
    className,
    children,
    ...rest
  }: HTMLAttributes<HTMLElement> & { className?: string }) => {
    // Inline `<code>` from markdown has no className; block code from
    // ```fenced``` arrives with `language-xxx`. We branch on that to keep
    // inline code visually distinct from prose without re-styling the
    // dark slab inside <pre>.
    const isBlock = typeof className === "string" && className.startsWith("language-");
    return (
      <code
        className={cn(
          "font-mono",
          isBlock
            ? "text-[0.92em] bg-transparent p-0 text-inherit"
            : "text-[0.92em] bg-rule/50 px-1.5 py-[1px] rounded text-ink font-normal",
          className,
        )}
        {...rest}
      >
        {children}
      </code>
    );
  },
  pre: (props: HTMLAttributes<HTMLPreElement>) => (
    <pre
      {...props}
      className="my-6 bg-[#1A1816] text-[#F4EFE6] rounded-lg p-4 overflow-x-auto font-mono text-[13px] leading-[1.65] [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-inherit"
    />
  ),
  Callout,
} as const;

/**
 * Extract H2 text from raw MDX source so the TOC can be built server-side
 * (matching ids generated by the `h2` component above). Skips H2s inside
 * fenced code blocks.
 */
export function extractTocItems(source: string): { id: string; text: string }[] {
  const items: { id: string; text: string }[] = [];
  let inFence = false;
  for (const rawLine of source.split("\n")) {
    const line = rawLine.trimEnd();
    if (line.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^##\s+(.+)$/.exec(line);
    const captured = m?.[1];
    if (!captured) continue;
    // Strip trailing `{#anchor}` hint if present.
    const text = captured.replace(/\s*\{#[^}]+\}\s*$/, "").trim();
    items.push({ id: slugify(text), text });
  }
  return items;
}
