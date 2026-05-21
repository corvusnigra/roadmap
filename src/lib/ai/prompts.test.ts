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

    expect(withoutSolve).toContain("НИКОГДА не показывайте полное решение");
    expect(withoutSolve).not.toContain("МОЖНО показать полное решение");

    expect(withSolve).toContain("МОЖНО показать полное решение");
    expect(withSolve).not.toContain("НИКОГДА не показывайте полное решение");
  });

  it("lists prerequisite titles in the context header", () => {
    const prompt = buildSystemPrompt({ ...base, solveRequested: false });
    expect(prompt).toContain('"HTML Document Structure"');
    expect(prompt).toContain('"How the Web Works"');
    expect(prompt).toContain('Текущий узел: "Semantic HTML"');
  });

  it("emits '(нет)' when there are no prerequisites", () => {
    const prompt = buildSystemPrompt({
      ...base,
      prerequisiteTitles: [],
      solveRequested: false,
    });
    expect(prompt).toContain("Предшествующие темы в контексте: (нет)");
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
    // Bumped to 2 when the system prompt was translated to Russian.
    // Bumping this requires correlating prior tutor_messages.model_id rows.
    expect(TUTOR_SYSTEM_PROMPT_VERSION).toBe(2);
  });
});
