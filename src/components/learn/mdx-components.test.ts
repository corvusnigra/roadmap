import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { extractTocItems, nodeToText, slugify } from "./mdx-components";

describe("slugify", () => {
  it("kebab-cases ASCII headings", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("preserves Cyrillic letters (HTML5 allows Unicode ids)", () => {
    expect(slugify("Где агент живёт в SDLC")).toBe("где-агент-живёт-в-sdlc");
  });

  it("collapses runs of punctuation into single hyphens", () => {
    expect(slugify("Hello, world!! How... are you?")).toBe(
      "hello-world-how-are-you",
    );
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  --hello--  ")).toBe("hello");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(slugify("   ")).toBe("");
  });

  it("keeps numbers", () => {
    expect(slugify("HTTP 200 OK")).toBe("http-200-ok");
  });
});

describe("nodeToText", () => {
  it("returns plain strings unchanged", () => {
    expect(nodeToText("hello")).toBe("hello");
  });

  it("converts numbers", () => {
    expect(nodeToText(42)).toBe("42");
  });

  it("flattens arrays of children", () => {
    expect(nodeToText(["a", "b", "c"])).toBe("abc");
  });

  it("returns empty string for null / false / undefined", () => {
    expect(nodeToText(null)).toBe("");
    expect(nodeToText(false)).toBe("");
    expect(nodeToText(undefined)).toBe("");
  });

  it("stops at depth limit to defend against cyclic structures", () => {
    // Build a 20-level deep "fake React element" — recursion should bail
    // around depth 10 and return whatever was accumulated, never throw.
    // (Bypass ReactNode strictness with `as unknown as ReactNode` — the
    // shape is intentionally not a real React element.)
    let node: { props: { children: unknown } } = {
      props: { children: "leaf" },
    };
    for (let i = 0; i < 20; i++) {
      node = { props: { children: node } };
    }
    expect(() => nodeToText(node as unknown as ReactNode)).not.toThrow();
  });
});

describe("extractTocItems", () => {
  it("returns one item per H2 in document order", () => {
    const src = "# Title\n\n## First\n\nbody\n\n## Second\n\nbody";
    expect(extractTocItems(src)).toEqual([
      { id: "first", text: "First" },
      { id: "second", text: "Second" },
    ]);
  });

  it("ignores H1 and H3", () => {
    const src = "# H1\n\n### H3\n\n## H2";
    expect(extractTocItems(src)).toEqual([{ id: "h2", text: "H2" }]);
  });

  it("ignores H2 inside ``` fenced code blocks", () => {
    const src = "## Real\n\n```\n## Fake\n```\n\n## AlsoReal";
    expect(extractTocItems(src)).toEqual([
      { id: "real", text: "Real" },
      { id: "alsoreal", text: "AlsoReal" },
    ]);
  });

  it("ignores H2 inside ~~~ fenced code blocks", () => {
    const src = "## Real\n\n~~~\n## Fake\n~~~\n\n## AlsoReal";
    expect(extractTocItems(src)).toEqual([
      { id: "real", text: "Real" },
      { id: "alsoreal", text: "AlsoReal" },
    ]);
  });

  it("strips trailing {#anchor} hint", () => {
    const src = "## Heading {#custom-id}";
    // We slugify the visible text, not the hint — keeps it consistent with
    // the h2 component which can't see the hint.
    expect(extractTocItems(src)).toEqual([
      { id: "heading", text: "Heading" },
    ]);
  });

  it("handles empty source", () => {
    expect(extractTocItems("")).toEqual([]);
  });

  it("handles Cyrillic headings", () => {
    const src = "## Где агент живёт в SDLC\n\n## Антипаттерны";
    expect(extractTocItems(src)).toEqual([
      { id: "где-агент-живёт-в-sdlc", text: "Где агент живёт в SDLC" },
      { id: "антипаттерны", text: "Антипаттерны" },
    ]);
  });
});
