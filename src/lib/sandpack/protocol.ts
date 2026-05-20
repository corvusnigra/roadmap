import { z } from "zod";

/**
 * Discriminator embedded in every cross-frame message between the Sandpack
 * preview iframe and our parent component. Cheap defence against rogue
 * postMessage chatter from extensions / other libraries.
 */
export const EXERCISE_MESSAGE_SOURCE = "rr-exercise" as const;

const SourceField = z.literal(EXERCISE_MESSAGE_SOURCE);

export const ExerciseBootedSchema = z.object({
  source: SourceField,
  kind: z.literal("booted"),
});

export const ExerciseResultSchema = z.object({
  source: SourceField,
  kind: z.literal("result"),
  ok: z.boolean(),
  message: z.string().min(1).max(500).optional(),
});

export const ExerciseMessageSchema = z.discriminatedUnion("kind", [
  ExerciseBootedSchema,
  ExerciseResultSchema,
]);

export type ExerciseBooted = z.infer<typeof ExerciseBootedSchema>;
export type ExerciseResult = z.infer<typeof ExerciseResultSchema>;
export type ExerciseMessage = z.infer<typeof ExerciseMessageSchema>;
