/**
 * Sync flashcards from MDX frontmatter into `skill_cards`. Idempotent —
 * existing rows keyed by (node_id, prompt) are updated, new flashcards are
 * inserted, and skill_cards whose prompt no longer appears in the MDX are
 * deleted (which cascades to user_card_state rows via the FK).
 *
 * Runs from the standalone `pnpm content:sync` and from `pnpm db:seed`.
 */

import { readdir } from "node:fs/promises";
import path from "node:path";

import { and, eq, inArray, notInArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  nodes as nodesTable,
  roles as rolesTable,
  skillCards,
} from "@/db/schema";
import { loadNode } from "@/lib/content/loader";

const CONTENT_ROOT = path.join(process.cwd(), "src", "content", "roles");

export interface SyncStats {
  rolesScanned: number;
  nodesScanned: number;
  cardsInserted: number;
  cardsUpdated: number;
  cardsDeleted: number;
}

async function listRoleSlugs(): Promise<string[]> {
  try {
    const entries = await readdir(CONTENT_ROOT, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

async function listNodeSlugs(roleSlug: string): Promise<string[]> {
  try {
    const entries = await readdir(path.join(CONTENT_ROOT, roleSlug), {
      withFileTypes: true,
    });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".mdx"))
      .map((e) => e.name.replace(/\.mdx$/, ""));
  } catch {
    return [];
  }
}

export interface SyncOptions {
  /** Pass an existing drizzle client; otherwise the sync opens its own. */
  databaseUrl?: string;
}

export async function syncContent(opts: SyncOptions = {}): Promise<SyncStats> {
  const url = opts.databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required to sync content.");
  }
  const client = postgres(url, { max: 1, prepare: false });
  const db = drizzle(client);

  const stats: SyncStats = {
    rolesScanned: 0,
    nodesScanned: 0,
    cardsInserted: 0,
    cardsUpdated: 0,
    cardsDeleted: 0,
  };

  try {
    const roleSlugs = await listRoleSlugs();
    for (const roleSlug of roleSlugs) {
      const role = await db
        .select({ id: rolesTable.id })
        .from(rolesTable)
        .where(eq(rolesTable.slug, roleSlug))
        .limit(1)
        .then((r) => r[0]);
      if (!role) {
        console.warn(
          `· role "${roleSlug}" has MDX but no DB row — run db:seed first.`,
        );
        continue;
      }
      stats.rolesScanned += 1;

      const nodeSlugs = await listNodeSlugs(roleSlug);
      for (const nodeSlug of nodeSlugs) {
        const node = await db
          .select({ id: nodesTable.id })
          .from(nodesTable)
          .where(eq(nodesTable.slug, nodeSlug))
          .limit(1)
          .then((r) => r[0]);
        if (!node) {
          console.warn(
            `· node "${nodeSlug}" has MDX but no DB row — run db:seed first.`,
          );
          continue;
        }
        stats.nodesScanned += 1;

        const { frontmatter } = await loadNode(roleSlug, nodeSlug);
        const mdxPrompts = frontmatter.flashcards.map((f) => f.front);

        // Existing skill_cards for this node, keyed by prompt.
        const existing = await db
          .select({
            id: skillCards.id,
            prompt: skillCards.prompt,
            answerMarkdown: skillCards.answerMarkdown,
          })
          .from(skillCards)
          .where(eq(skillCards.nodeId, node.id));
        const existingByPrompt = new Map(
          existing.map((r) => [r.prompt, r] as const),
        );

        for (const card of frontmatter.flashcards) {
          const hit = existingByPrompt.get(card.front);
          if (!hit) {
            await db.insert(skillCards).values({
              nodeId: node.id,
              prompt: card.front,
              answerMarkdown: card.back,
              kind: "flashcard",
            });
            stats.cardsInserted += 1;
          } else if (hit.answerMarkdown !== card.back) {
            await db
              .update(skillCards)
              .set({ answerMarkdown: card.back })
              .where(eq(skillCards.id, hit.id));
            stats.cardsUpdated += 1;
          }
        }

        // Drop skill_cards whose prompt is no longer in the MDX. Cascades to
        // user_card_state via the FK ON DELETE CASCADE.
        const idsToKeep = existing
          .filter((r) => mdxPrompts.includes(r.prompt))
          .map((r) => r.id);
        if (mdxPrompts.length === 0) {
          const stale = await db
            .delete(skillCards)
            .where(eq(skillCards.nodeId, node.id))
            .returning({ id: skillCards.id });
          stats.cardsDeleted += stale.length;
        } else if (idsToKeep.length > 0) {
          const stale = await db
            .delete(skillCards)
            .where(
              and(
                eq(skillCards.nodeId, node.id),
                notInArray(skillCards.id, idsToKeep),
              ),
            )
            .returning({ id: skillCards.id });
          stats.cardsDeleted += stale.length;
        } else {
          // Edge case: no overlap at all → wipe & insert handled above.
          const stale = await db
            .delete(skillCards)
            .where(
              and(
                eq(skillCards.nodeId, node.id),
                inArray(skillCards.id, existing.map((r) => r.id)),
              ),
            )
            .returning({ id: skillCards.id });
          stats.cardsDeleted += stale.length;
        }
      }
    }
  } finally {
    await client.end();
  }

  return stats;
}
