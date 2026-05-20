/**
 * Versioned system prompt for the in-page tutor. Bump TUTOR_SYSTEM_PROMPT_VERSION
 * whenever the wording changes — the version is persisted with every
 * tutor_messages row so future audits can correlate behaviour to the prompt
 * that generated it.
 */
export const TUTOR_SYSTEM_PROMPT_VERSION = 1 as const;

/** Hard cap on Claude's output. Stops runaway costs and keeps replies focused. */
export const TUTOR_MAX_TOKENS = 1000;

/** Model id used for every tutor exchange. Recorded on each message. */
export const TUTOR_MODEL = "claude-sonnet-4-5";

/**
 * The refusal phrase the assistant must use verbatim when asked about
 * material outside the current node's context. Tests assert on this string.
 */
export const TUTOR_REFUSAL_PREFIX =
  "This is outside the current node's material — come back once you've covered ";

export interface BuildSystemPromptInput {
  /** Title of the node the user is studying. */
  currentNodeTitle: string;
  /** Titles of every transitive prerequisite included in the context. */
  prerequisiteTitles: string[];
  /** Concatenated retrieved chunks (already truncated to a budget). */
  contextBlock: string;
  /** When true, the assistant is allowed to reveal the full code solution. */
  solveRequested: boolean;
}

export function buildSystemPrompt({
  currentNodeTitle,
  prerequisiteTitles,
  contextBlock,
  solveRequested,
}: BuildSystemPromptInput): string {
  const prereqLine =
    prerequisiteTitles.length > 0
      ? prerequisiteTitles.map((t) => `"${t}"`).join(", ")
      : "(none)";

  return [
    "You are the RoleRoadmap tutor. Help a learner understand the current node.",
    "",
    "HARD RULES",
    `1. Use ONLY the <context> block below. If the answer is not present, reply with exactly: "${TUTOR_REFUSAL_PREFIX}<prereq>." Pick the closest prereq title from the listed prerequisites; if none apply, write "the prerequisite for this node".`,
    "2. Never invent code, APIs, library names, or commands that don't appear verbatim in the context.",
    "3. When the user is stuck on a practice item, ask ONE Socratic question that nudges them toward the next observation. Do not write the answer.",
    solveRequested
      ? "4. The user's most recent message contained `/solve`, so you MAY reveal the full code solution. Show it in a fenced code block and add one sentence of intent above it."
      : "4. NEVER reveal a full code solution. If the user hasn't typed the exact token `/solve` in this message, refuse with: \"I won't paste the full solution — try the exercise, then say `/solve` if you really want it.\"",
    "5. Do not write or modify the learner's exercise code. Explain only.",
    "6. Keep replies under 200 words unless the user explicitly asks for more.",
    "",
    "FORMAT",
    "- Plain markdown. Fenced code blocks with the language tag.",
    "- When citing the context, name the source node in italics.",
    "",
    "CONTEXT",
    `Current node: "${currentNodeTitle}"`,
    `Prerequisites in context: ${prereqLine}`,
    "",
    "<context>",
    contextBlock,
    "</context>",
  ].join("\n");
}
