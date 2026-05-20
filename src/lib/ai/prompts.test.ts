import { describe, expect, it } from "vitest";

import {
  buildSystemPrompt,
  TUTOR_REFUSAL_PREFIX,
  TUTOR_SYSTEM_PROMPT_VERSION,
} from "./prompts";

describe("buildSystemPrompt", () => {
  const base = {
    currentNodeTitle: "Semantic HTML",
    prerequisiteTitles: ["HTML Document Structure", "How the Web Works"],
    contextBlock: "...mdx body...",
  };

  it("embeds the canonical refusal phrase verbatim", () => {
    const prompt = buildSystemPrompt({ ...base, solveRequested: false });
    expect(prompt).toContain(TUTOR_REFUSAL_PREFIX);
  });

  it("flips the solve-permission rule based on solveRequested", () => {
    const withoutSolve = buildSystemPrompt({ ...base, solveRequested: false });
    const withSolve = buildSystemPrompt({ ...base, solveRequested: true });

    expect(withoutSolve).toContain("NEVER reveal a full code solution");
    expect(withoutSolve).not.toContain("you MAY reveal the full code solution");

    expect(withSolve).toContain("you MAY reveal the full code solution");
    expect(withSolve).not.toContain("NEVER reveal a full code solution");
  });

  it("lists prerequisite titles in the context header", () => {
    const prompt = buildSystemPrompt({ ...base, solveRequested: false });
    expect(prompt).toContain('"HTML Document Structure"');
    expect(prompt).toContain('"How the Web Works"');
    expect(prompt).toContain('Current node: "Semantic HTML"');
  });

  it("emits '(none)' when there are no prerequisites", () => {
    const prompt = buildSystemPrompt({
      ...base,
      prerequisiteTitles: [],
      solveRequested: false,
    });
    expect(prompt).toContain("Prerequisites in context: (none)");
  });

  it("wraps the context block inside <context> tags so the model can locate it", () => {
    const prompt = buildSystemPrompt({
      ...base,
      contextBlock: "## A heading\nbody of section",
      solveRequested: false,
    });
    expect(prompt).toMatch(/<context>\s*## A heading[\s\S]*<\/context>/);
  });

  it("keeps the schema version stable so persisted model_id stays meaningful", () => {
    // Bumping this requires correlating prior tutor_messages.model_id rows.
    expect(TUTOR_SYSTEM_PROMPT_VERSION).toBe(1);
  });
});
