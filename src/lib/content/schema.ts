import { z } from "zod";

/**
 * Bumped whenever the contract changes in a way that older files would fail
 * to validate. The schema asserts `z.literal(<current>)` so loading an out-of-
 * date file fails loudly instead of silently dropping unknown fields.
 */
export const FRONTMATTER_SCHEMA_VERSION = 1 as const;

const SLUG_REGEX = /^[a-z0-9-]+$/;

// Plain z.object — no `.refine` here because z.discriminatedUnion rejects
// ZodEffects. The answerIndex <-> options invariant is enforced by a top-
// level superRefine on NodeFrontmatterSchema below.
const McqItem = z.object({
  kind: z.literal("mcq"),
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(8),
  answerIndex: z.number().int().nonnegative(),
  explanation: z.string().min(1),
});

const CodeItem = z.object({
  kind: z.literal("code"),
  prompt: z.string().min(1),
  starterFile: z.string().min(1),
  solutionFile: z.string().min(1),
  testsFile: z.string().min(1).optional(),
  language: z.enum(["html", "css", "js", "ts"]).default("html"),
});

const PracticeItem = z.discriminatedUnion("kind", [McqItem, CodeItem]);

const Flashcard = z.object({
  front: z.string().min(1),
  back: z.string().min(1),
});

/**
 * Node lifecycle stage:
 *  - `draft`     — work in progress. Scaffolder writes this by default;
 *                  `content:check` may flag remaining TODOs.
 *  - `published` — ready for learners. CI gating should refuse to ship
 *                  drafts; for MVP we just store the field.
 */
export const NodeStatus = z.enum(["draft", "published"]);
export type NodeStatusValue = z.infer<typeof NodeStatus>;

const BaseFrontmatter = z.object({
  schemaVersion: z.literal(FRONTMATTER_SCHEMA_VERSION).default(1),
  slug: z.string().regex(SLUG_REGEX, "slug must be kebab-case (a-z, 0-9, -)"),
  title: z.string().min(1),
  summary: z.string().min(1),
  status: NodeStatus.default("draft"),
  estimatedMinutes: z.number().int().positive().max(180),
  prerequisites: z
    .array(z.string().regex(SLUG_REGEX, "prerequisite slugs must be kebab-case"))
    .default([]),
  learningOutcomes: z.array(z.string().min(1)).min(1),
  practice: z.array(PracticeItem).default([]),
  flashcards: z.array(Flashcard).default([]),
  /**
   * Pool of multiple-choice questions for the mastery quiz. The schema
   * enforces a floor of 5 — the minimum needed for the "5 of N" pick logic.
   * `content:check` raises that bar to 6 for `status: published` nodes so
   * the random pick is actually random (1 spare beyond the picked 5).
   */
  masteryQuiz: z.array(McqItem).min(5),
});

export const NodeFrontmatterSchema = BaseFrontmatter.superRefine((data, ctx) => {
  // answerIndex must reference a real option, for both practice MCQs and
  // mastery quiz items. Done at the top level so the discriminated union
  // above stays a plain ZodObject (required by zod).
  const visit = (items: { kind: string; options?: string[]; answerIndex?: number }[], scope: string) => {
    items.forEach((item, i) => {
      if (item.kind !== "mcq") return;
      const options = item.options ?? [];
      const idx = item.answerIndex ?? -1;
      if (idx < 0 || idx >= options.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [scope, i, "answerIndex"],
          message: `answerIndex (${idx}) must reference a valid option (0..${options.length - 1})`,
        });
      }
    });
  };
  visit(data.practice as { kind: string; options?: string[]; answerIndex?: number }[], "practice");
  visit(data.masteryQuiz as { kind: string; options?: string[]; answerIndex?: number }[], "masteryQuiz");
});

export type NodeFrontmatter = z.infer<typeof NodeFrontmatterSchema>;
export type PracticeMcq = z.infer<typeof McqItem>;
export type PracticeCode = z.infer<typeof CodeItem>;
export type FlashcardInput = z.infer<typeof Flashcard>;
