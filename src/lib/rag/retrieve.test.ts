import { afterEach, describe, expect, it, vi } from "vitest";

// Mock loadNode to keep this unit test off the filesystem.
const loadNodeMock = vi.fn();
const { ContentNotFoundError } = await vi.hoisted(async () => {
  class ContentNotFoundError extends Error {}
  return { ContentNotFoundError };
});
vi.mock("@/lib/content/loader", () => ({
  loadNode: (...args: unknown[]) => loadNodeMock(...args),
  ContentNotFoundError,
}));

import {
  packChunksForPrompt,
  retrieveContext,
  splitMdxIntoSections,
} from "./retrieve";

type FakeFrontmatter = {
  slug: string;
  title: string;
  prerequisites: string[];
};

function makeFakeNode(slug: string, title: string, prerequisites: string[], body: string) {
  return {
    frontmatter: { slug, title, prerequisites } as FakeFrontmatter,
    source: body,
    filePath: `/fake/${slug}.mdx`,
  };
}

afterEach(() => {
  loadNodeMock.mockReset();
});

describe("splitMdxIntoSections", () => {
  it("splits on ##  headings and captures the heading", () => {
    const out = splitMdxIntoSections(
      "Intro paragraph.\n\n## One\nBody of one.\n\n## Two\nBody of two.",
    );
    expect(out).toEqual([
      { heading: null, content: "Intro paragraph." },
      { heading: "One", content: "Body of one." },
      { heading: "Two", content: "Body of two." },
    ]);
  });

  it("returns a single null-headed chunk when there are no ## headings", () => {
    const out = splitMdxIntoSections("Just one paragraph.");
    expect(out).toEqual([{ heading: null, content: "Just one paragraph." }]);
  });
});

describe("retrieveContext", () => {
  it("loads the current node + transitive prerequisites only", async () => {
    loadNodeMock.mockImplementation(async (_role: string, slug: string) => {
      const tree: Record<string, ReturnType<typeof makeFakeNode>> = {
        c: makeFakeNode("c", "C", ["b"], "## C heading\nbody of c"),
        b: makeFakeNode("b", "B", ["a"], "## B heading\nbody of b"),
        a: makeFakeNode("a", "A", [], "## A heading\nbody of a"),
        // unrelated node — must NOT be loaded.
        z: makeFakeNode("z", "Z", [], "## Z heading\nbody of z"),
      };
      const hit = tree[slug];
      if (!hit) throw new ContentNotFoundError();
      return hit;
    });

    const ctx = await retrieveContext("role", "c");

    expect(ctx.current.slug).toBe("c");
    expect(ctx.prerequisites.map((p) => p.slug).sort()).toEqual(["a", "b"]);
    expect(ctx.chunks.map((c) => c.nodeSlug)).toEqual(["c", "b", "a"]);
    // Z was never queried.
    const loadedSlugs = loadNodeMock.mock.calls.map((c) => c[1]);
    expect(loadedSlugs.sort()).toEqual(["a", "b", "c"]);
  });

  it("breaks prerequisite cycles instead of infinite-looping", async () => {
    loadNodeMock.mockImplementation(async (_r: string, slug: string) => {
      const tree: Record<string, ReturnType<typeof makeFakeNode>> = {
        a: makeFakeNode("a", "A", ["b"], "## A heading\nbody"),
        b: makeFakeNode("b", "B", ["a"], "## B heading\nbody"), // points back to a
      };
      const hit = tree[slug];
      if (!hit) throw new ContentNotFoundError();
      return hit;
    });

    const ctx = await retrieveContext("role", "a");
    expect(ctx.current.slug).toBe("a");
    expect(ctx.prerequisites.map((p) => p.slug)).toEqual(["b"]);
  });

  it("reports prerequisite slugs that have no MDX file rather than throwing", async () => {
    loadNodeMock.mockImplementation(async (_r: string, slug: string) => {
      if (slug === "x") {
        return makeFakeNode("x", "X", ["missing-prereq"], "## X");
      }
      throw new ContentNotFoundError();
    });

    const ctx = await retrieveContext("role", "x");
    expect(ctx.missingPrereqSlugs).toEqual(["missing-prereq"]);
    expect(ctx.prerequisites).toEqual([]);
  });

  it("throws when the current node itself is missing", async () => {
    loadNodeMock.mockImplementation(async () => {
      throw new ContentNotFoundError();
    });
    await expect(retrieveContext("role", "nope")).rejects.toBeInstanceOf(
      ContentNotFoundError,
    );
  });
});

describe("packChunksForPrompt", () => {
  it("drops chunks past the character budget", () => {
    const chunks = [
      { nodeSlug: "a", nodeTitle: "A", heading: "h1", content: "x".repeat(100) },
      { nodeSlug: "b", nodeTitle: "B", heading: null, content: "y".repeat(100) },
      { nodeSlug: "c", nodeTitle: "C", heading: null, content: "z".repeat(100) },
    ];
    const packed = packChunksForPrompt(chunks, 250);
    expect(packed).toContain("From \"A\"");
    expect(packed).toContain("From \"B\"");
    expect(packed).not.toContain("From \"C\"");
  });
});
