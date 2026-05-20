// No `import "server-only"` here: the loader is also used by the sync script
// (`pnpm content:sync`) which runs in raw Node via tsx — `server-only` throws
// in that environment by design. Implicit server-only safety comes from the
// `node:fs/promises` import below: the Next bundler can't ship that to a
// client component.

import { readFile } from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";

import {
  NodeFrontmatterSchema,
  type NodeFrontmatter,
} from "./schema";

const CONTENT_ROOT = path.join(process.cwd(), "src", "content", "roles");

export class ContentNotFoundError extends Error {
  constructor(roleSlug: string, nodeSlug: string) {
    super(
      `No MDX file at src/content/roles/${roleSlug}/${nodeSlug}.mdx for node ${nodeSlug}.`,
    );
    this.name = "ContentNotFoundError";
  }
}

export class ContentValidationError extends Error {
  readonly issues: unknown;
  constructor(filePath: string, issues: unknown) {
    super(`Frontmatter validation failed for ${filePath}`);
    this.name = "ContentValidationError";
    this.issues = issues;
  }
}

export interface LoadedNode {
  /** Validated YAML frontmatter. */
  frontmatter: NodeFrontmatter;
  /** Raw MDX source (without frontmatter), ready to feed to next-mdx-remote. */
  source: string;
  /** Filesystem path of the MDX file, useful for error messages. */
  filePath: string;
}

function resolveNodePath(roleSlug: string, nodeSlug: string): string {
  return path.join(CONTENT_ROOT, roleSlug, `${nodeSlug}.mdx`);
}

/**
 * Reads `src/content/roles/<roleSlug>/<nodeSlug>.mdx`, separates frontmatter
 * via gray-matter, validates with NodeFrontmatterSchema, and returns the
 * parsed pair. Throws ContentNotFoundError on missing files (callers should
 * map this to a 404) and ContentValidationError on schema mismatches.
 */
export async function loadNode(
  roleSlug: string,
  nodeSlug: string,
): Promise<LoadedNode> {
  const filePath = resolveNodePath(roleSlug, nodeSlug);

  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    if (
      typeof err === "object" &&
      err &&
      "code" in err &&
      (err as { code: string }).code === "ENOENT"
    ) {
      throw new ContentNotFoundError(roleSlug, nodeSlug);
    }
    throw err;
  }

  const { data, content } = matter(raw);
  const parsed = NodeFrontmatterSchema.safeParse(data);
  if (!parsed.success) {
    throw new ContentValidationError(filePath, parsed.error.flatten());
  }

  // Defensive: file's slug should match the URL slug — otherwise authors
  // can accidentally route html-semantics.mdx as semantics.mdx and lose track.
  if (parsed.data.slug !== nodeSlug) {
    throw new ContentValidationError(filePath, {
      formErrors: [
        `slug field in frontmatter ("${parsed.data.slug}") must match the filename ("${nodeSlug}")`,
      ],
      fieldErrors: {},
    });
  }

  return { frontmatter: parsed.data, source: content, filePath };
}
