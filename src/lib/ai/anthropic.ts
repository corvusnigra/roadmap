import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { TUTOR_MAX_TOKENS, TUTOR_MODEL } from "./prompts";

const STUB_SENTINEL = "stub-anthropic-key";

interface AnthropicTurn {
  role: "user" | "assistant";
  content: string;
}

export interface TutorReplyInput {
  systemPrompt: string;
  history: AnthropicTurn[];
  userMessage: string;
}

export interface TutorReply {
  text: string;
  model: string;
  /**
   * True when the wrapper returned a canned response because ANTHROPIC_API_KEY
   * is the stub placeholder (or empty). UI can show a "configure your key"
   * hint in that case.
   */
  stubbed: boolean;
}

function getClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key === STUB_SENTINEL) return null;
  return new Anthropic({ apiKey: key });
}

/**
 * Single round-trip to Anthropic. Returns a stub reply when the API key is
 * the placeholder so local dev without billing still works end-to-end.
 */
export async function generateTutorReply(
  input: TutorReplyInput,
): Promise<TutorReply> {
  const client = getClient();
  if (!client) {
    return {
      text:
        "(Tutor not configured.) The ANTHROPIC_API_KEY in `.env.local` is the " +
        "stub placeholder. Drop in a real key to get live answers grounded " +
        "in this node's MDX.",
      model: "stub",
      stubbed: true,
    };
  }

  const response = await client.messages.create({
    model: TUTOR_MODEL,
    max_tokens: TUTOR_MAX_TOKENS,
    system: input.systemPrompt,
    messages: [
      ...input.history.map((t) => ({ role: t.role, content: t.content })),
      { role: "user" as const, content: input.userMessage },
    ],
  });

  const text = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();

  return {
    text: text || "(empty response from Anthropic)",
    model: response.model,
    stubbed: false,
  };
}
