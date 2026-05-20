import { loadNode, ContentNotFoundError } from "@/lib/content/loader";

export interface ContextChunk {
  /** Slug of the node this chunk came from. */
  nodeSlug: string;
  /** Title of the originating node (for citation). */
  nodeTitle: string;
  /** Section heading if the chunk corresponds to a `##` block, else null. */
  heading: string | null;
  /** Raw MDX/markdown body of the chunk. */
  content: string;
}

export interface RetrievedContext {
  current: { slug: string; title: string };
  /** Transitive prerequisite nodes whose chunks landed in the context. */
  prerequisites: { slug: string; title: string }[];
  chunks: ContextChunk[];
  /** Sum of `content.length` across all chunks — useful for budget tracking. */
  approxCharCount: number;
  /** Slugs that the loader couldn't find on disk; surfaced for diagnostics. */
  missingPrereqSlugs: string[];
}

/** Split MDX body into `##`-headed sections. Falls back to the whole body. */
export function splitMdxIntoSections(
  mdx: string,
): Array<{ heading: string | null; content: string }> {
  const lines = mdx.split("\n");
  const sections: Array<{ heading: string | null; content: string }> = [];
  let buffer: string[] = [];
  let currentHeading: string | null = null;

  function flush() {
    const content = buffer.join("\n").trim();
    if (content) sections.push({ heading: currentHeading, content });
  }

  for (const line of lines) {
    const h2 = /^##\s+(.*)$/.exec(line);
    if (h2) {
      flush();
      buffer = [];
      currentHeading = h2[1]?.trim() ?? null;
      continue;
    }
    buffer.push(line);
  }
  flush();
  return sections;
}

interface LoadedForRetrieval {
  slug: string;
  title: string;
  prereqs: string[];
  body: string;
}

async function tryLoad(
  roleSlug: string,
  nodeSlug: string,
): Promise<LoadedForRetrieval | null> {
  try {
    const loaded = await loadNode(roleSlug, nodeSlug);
    return {
      slug: loaded.frontmatter.slug,
      title: loaded.frontmatter.title,
      prereqs: loaded.frontmatter.prerequisites,
      body: loaded.source,
    };
  } catch (err) {
    if (err instanceof ContentNotFoundError) return null;
    throw err;
  }
}

/**
 * Build the RAG context for an in-page tutor request. Loads the current MDX
 * + every transitive prerequisite, splits each body into `##` sections, and
 * returns a flat ordered list of chunks. The current node's chunks come
 * first so the prompt-stuffer can prioritise them under a token budget.
 *
 * Prereq cycles are detected and broken on the second visit; missing MDX
 * files (slugs the seed knows but no MDX exists yet) land in
 * `missingPrereqSlugs` rather than throwing.
 */
export async function retrieveContext(
  roleSlug: string,
  currentNodeSlug: string,
): Promise<RetrievedContext> {
  const current = await tryLoad(roleSlug, currentNodeSlug);
  if (!current) {
    throw new ContentNotFoundError(roleSlug, currentNodeSlug);
  }

  // BFS through prerequisites.
  const visited = new Set<string>([current.slug]);
  const queue: string[] = [...current.prereqs];
  const loadedPrereqs: LoadedForRetrieval[] = [];
  const missingPrereqSlugs: string[] = [];

  while (queue.length > 0) {
    const slug = queue.shift()!;
    if (visited.has(slug)) continue;
    visited.add(slug);
    const loaded = await tryLoad(roleSlug, slug);
    if (!loaded) {
      missingPrereqSlugs.push(slug);
      continue;
    }
    loadedPrereqs.push(loaded);
    for (const p of loaded.prereqs) {
      if (!visited.has(p)) queue.push(p);
    }
  }

  const chunks: ContextChunk[] = [];
  function pushChunks(node: LoadedForRetrieval) {
    for (const section of splitMdxIntoSections(node.body)) {
      chunks.push({
        nodeSlug: node.slug,
        nodeTitle: node.title,
        heading: section.heading,
        content: section.content,
      });
    }
  }

  pushChunks(current);
  for (const p of loadedPrereqs) pushChunks(p);

  const approxCharCount = chunks.reduce((n, c) => n + c.content.length, 0);

  return {
    current: { slug: current.slug, title: current.title },
    prerequisites: loadedPrereqs.map((p) => ({ slug: p.slug, title: p.title })),
    chunks,
    approxCharCount,
    missingPrereqSlugs,
  };
}

/**
 * Pack chunks into a single `<context>` block bounded by `maxChars`. Drops
 * chunks past the budget; current-node chunks are pushed first so they
 * always make it in.
 */
export function packChunksForPrompt(
  chunks: ContextChunk[],
  maxChars: number,
): string {
  let used = 0;
  const parts: string[] = [];
  for (const c of chunks) {
    const header = c.heading
      ? `### From "${c.nodeTitle}" — ${c.heading}`
      : `### From "${c.nodeTitle}"`;
    const block = `${header}\n${c.content}`;
    if (used + block.length > maxChars) break;
    parts.push(block);
    used += block.length;
  }
  return parts.join("\n\n---\n\n");
}
