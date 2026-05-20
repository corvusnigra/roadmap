import { describe, expect, it } from "vitest";

import { NodeFrontmatterSchema } from "./schema";

const validFixture = {
  schemaVersion: 1,
  slug: "html-semantics",
  title: "Semantic HTML",
  summary: "Why <article>, <nav>, <header> matter for accessibility and SEO.",
  estimatedMinutes: 25,
  prerequisites: ["html-document-structure"],
  learningOutcomes: ["Identify when to use <section> vs <article>."],
  practice: [
    {
      kind: "mcq",
      prompt: "Which element best wraps a self-contained blog post?",
      options: ["<div>", "<article>", "<section>", "<aside>"],
      answerIndex: 1,
      explanation: "An <article> is self-contained, independently distributable content.",
    },
  ],
  flashcards: [{ front: "When do you use <article>?", back: "Self-contained content." }],
  masteryQuiz: Array.from({ length: 5 }, (_, i) => ({
    kind: "mcq" as const,
    prompt: `Question ${i + 1}`,
    options: ["A", "B"],
    answerIndex: 0,
    explanation: "Because of reasons.",
  })),
};

describe("NodeFrontmatterSchema", () => {
  it("accepts a well-formed frontmatter object", () => {
    expect(() => NodeFrontmatterSchema.parse(validFixture)).not.toThrow();
  });

  it("rejects answerIndex that points outside options", () => {
    const broken = {
      ...validFixture,
      practice: [
        {
          ...validFixture.practice[0],
          options: ["A", "B"],
          answerIndex: 5,
        },
      ],
    };
    expect(() => NodeFrontmatterSchema.parse(broken)).toThrow();
  });

  it("rejects non-kebab-case slugs", () => {
    const broken = { ...validFixture, slug: "Not_Kebab" };
    expect(() => NodeFrontmatterSchema.parse(broken)).toThrow();
  });

  it("rejects non-kebab-case prerequisite slugs", () => {
    const broken = { ...validFixture, prerequisites: ["Bad Slug"] };
    expect(() => NodeFrontmatterSchema.parse(broken)).toThrow();
  });

  it("requires at least one learning outcome", () => {
    const broken = { ...validFixture, learningOutcomes: [] };
    expect(() => NodeFrontmatterSchema.parse(broken)).toThrow();
  });

  it("requires masteryQuiz with at least 5 items", () => {
    const broken = { ...validFixture, masteryQuiz: validFixture.masteryQuiz.slice(0, 4) };
    expect(() => NodeFrontmatterSchema.parse(broken)).toThrow();
  });

  it("rejects practice items with an unknown kind", () => {
    const broken = {
      ...validFixture,
      practice: [{ kind: "video", prompt: "x" }],
    };
    expect(() => NodeFrontmatterSchema.parse(broken)).toThrow();
  });

  it("rejects estimatedMinutes <= 0 or > 180", () => {
    expect(() =>
      NodeFrontmatterSchema.parse({ ...validFixture, estimatedMinutes: 0 }),
    ).toThrow();
    expect(() =>
      NodeFrontmatterSchema.parse({ ...validFixture, estimatedMinutes: 181 }),
    ).toThrow();
  });

  it("rejects schemaVersion mismatches", () => {
    const broken = { ...validFixture, schemaVersion: 2 };
    expect(() => NodeFrontmatterSchema.parse(broken)).toThrow();
  });

  it("requires explanation on MCQ items", () => {
    const broken = {
      ...validFixture,
      practice: [
        {
          kind: "mcq",
          prompt: "X?",
          options: ["A", "B"],
          answerIndex: 0,
        },
      ],
    };
    expect(() => NodeFrontmatterSchema.parse(broken)).toThrow();
  });
});
