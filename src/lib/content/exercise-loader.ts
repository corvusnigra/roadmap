import { readFile } from "node:fs/promises";
import path from "node:path";

import type { PracticeCode } from "@/lib/content/schema";

const CONTENT_ROOT = path.join(process.cwd(), "src", "content", "roles");

export class ExerciseFileMissingError extends Error {
  readonly itemPath: string;
  constructor(roleSlug: string, relPath: string) {
    super(
      `Exercise file not found: src/content/roles/${roleSlug}/${relPath}. ` +
        "Check the path in the MDX frontmatter.",
    );
    this.itemPath = relPath;
    this.name = "ExerciseFileMissingError";
  }
}

export interface LoadedExercise {
  itemKey: string;
  prompt: string;
  language: "html" | "css" | "js" | "ts";
  /** Visible to the user; what they edit. */
  starterCode: string;
  /** Author-only; for /solve gating later. */
  solutionCode: string;
  /** Assertions that post a result via `__report()`. */
  testsCode: string;
}

async function readRelative(roleSlug: string, relPath: string): Promise<string> {
  const abs = path.join(CONTENT_ROOT, roleSlug, relPath);
  try {
    return await readFile(abs, "utf8");
  } catch (err) {
    if (
      typeof err === "object" &&
      err &&
      "code" in err &&
      (err as { code: string }).code === "ENOENT"
    ) {
      throw new ExerciseFileMissingError(roleSlug, relPath);
    }
    throw err;
  }
}

/**
 * Resolve the starter/solution/tests files referenced by a `PracticeCode`
 * frontmatter item. Reads happen in parallel.
 */
export async function loadExercise(
  roleSlug: string,
  itemKey: string,
  item: PracticeCode,
): Promise<LoadedExercise> {
  const [starterCode, solutionCode, testsCode] = await Promise.all([
    readRelative(roleSlug, item.starterFile),
    readRelative(roleSlug, item.solutionFile),
    item.testsFile
      ? readRelative(roleSlug, item.testsFile)
      : Promise.resolve(""),
  ]);

  return {
    itemKey,
    prompt: item.prompt,
    language: item.language,
    starterCode,
    solutionCode,
    testsCode,
  };
}
