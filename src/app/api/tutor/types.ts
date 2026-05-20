export interface TutorTurn {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface SendTutorMessageResult {
  user: TutorTurn;
  assistant: TutorTurn;
  stubbed: boolean;
}

/**
 * Thrown by `sendTutorMessage` when the per-user sliding window for tutor
 * requests is exhausted. The client surfaces `message` via toast.
 */
export class RateLimitedError extends Error {
  readonly used: number;
  readonly limit: number;
  readonly windowSeconds: number;
  constructor(used: number, limit: number, windowSeconds: number) {
    super(
      `Tutor rate limit reached: ${used}/${limit} per ${windowSeconds / 60} min.`,
    );
    this.name = "RateLimitedError";
    this.used = used;
    this.limit = limit;
    this.windowSeconds = windowSeconds;
  }
}
