/**
 * MDX-first content sync. Два режима работы:
 *
 *   Режим 1 — Full sync (для ролей с `_role.json` в папке):
 *     Upsert роль + узлы + prereq edges + skill_cards из MDX.
 *     Нет нужды в <role>-curriculum.ts или регистрации в db/seed.ts.
 *     Drop files in src/content/roles/<slug>/, run `pnpm content:sync`.
 *
 *   Режим 2 — Cards-only sync (для старых ролей без `_role.json`):
 *     Только синхронизация flashcards из MDX в skill_cards.
 *     Узлы должны уже существовать в БД (run `pnpm db:seed` отдельно).
 *
 * Запускается из standalone `pnpm content:sync` и из `pnpm db:seed`.
 */

import { readdir, readFile, access, constants } from "node:fs/promises";
import path from "node:path";

import { and, eq, inArray, notInArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  nodePrerequisites,
  nodes as nodesTable,
  roles as rolesTable,
  skillCards,
} from "@/db/schema";
import { loadNode } from "@/lib/content/loader";
import { RoleMetaSchema, type RoleMeta } from "@/lib/content/role-schema";

const CONTENT_ROOT = path.join(process.cwd(), "src", "content", "roles");

// Layout: x по уровню, y по индексу внутри уровня.
function positionForLevel(level: number, idxInLevel: number) {
  return {
    x: 120 + level * 280,
    y: 80 + idxInLevel * 140,
  };
}

export interface SyncStats {
  rolesScanned: number;
  rolesUpserted: number;
  nodesScanned: number;
  nodesUpserted: number;
  edgesUpserted: number;
  cardsInserted: number;
  cardsUpdated: number;
  cardsDeleted: number;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
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

async function loadRoleMeta(roleSlug: string): Promise<RoleMeta | null> {
  const metaPath = path.join(CONTENT_ROOT, roleSlug, "_role.json");
  if (!(await fileExists(metaPath))) return null;
  const raw = await readFile(metaPath, "utf8");
  const parsed = RoleMetaSchema.parse(JSON.parse(raw));
  return parsed;
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
    rolesUpserted: 0,
    nodesScanned: 0,
    nodesUpserted: 0,
    edgesUpserted: 0,
    cardsInserted: 0,
    cardsUpdated: 0,
    cardsDeleted: 0,
  };

  try {
    const roleSlugs = await listRoleSlugs();
    for (const roleSlug of roleSlugs) {
      const meta = await loadRoleMeta(roleSlug);

      if (meta) {
        // ===== Режим 1: full sync ===========================================
        await fullSyncRole(db, roleSlug, meta, stats);
      } else {
        // ===== Режим 2: cards-only (legacy) =================================
        await cardsOnlySyncRole(db, roleSlug, stats);
      }
    }
  } finally {
    await client.end();
  }

  return stats;
}

/**
 * Полный sync роли из MDX + `_role.json`. Upsert'ит роль, узлы, prereq edges,
 * затем синхронизирует flashcards. Идемпотентно.
 */
async function fullSyncRole(
  db: ReturnType<typeof drizzle>,
  roleSlug: string,
  meta: RoleMeta,
  stats: SyncStats,
): Promise<void> {
  stats.rolesScanned += 1;

  // 1. Upsert role
  const [role] = await db
    .insert(rolesTable)
    .values({
      slug: roleSlug,
      title: meta.title,
      summary: meta.summary,
      status: meta.status,
    })
    .onConflictDoUpdate({
      target: rolesTable.slug,
      set: {
        title: meta.title,
        summary: meta.summary,
        status: meta.status,
      },
    })
    .returning();
  if (!role) throw new Error(`Failed to upsert role ${roleSlug}`);
  stats.rolesUpserted += 1;

  // 2. Load all node frontmatters
  const nodeSlugs = await listNodeSlugs(roleSlug);
  const loaded: {
    slug: string;
    title: string;
    summary: string;
    estimatedMinutes: number;
    level: number;
    prerequisites: string[];
    flashcards: { front: string; back: string }[];
  }[] = [];
  for (const nodeSlug of nodeSlugs) {
    const { frontmatter } = await loadNode(roleSlug, nodeSlug);
    loaded.push({
      slug: nodeSlug,
      title: frontmatter.title,
      summary: frontmatter.summary,
      estimatedMinutes: frontmatter.estimatedMinutes,
      // Если level не задан в frontmatter — кладём всех в L0. Автор может
      // потом расставить уровни сам.
      level: frontmatter.level ?? 0,
      prerequisites: frontmatter.prerequisites,
      flashcards: frontmatter.flashcards,
    });
    stats.nodesScanned += 1;
  }

  // 3. Группируем по level, считаем idxInLevel для позиции
  const byLevel = new Map<number, typeof loaded>();
  for (const n of loaded) {
    const bucket = byLevel.get(n.level) ?? [];
    bucket.push(n);
    byLevel.set(n.level, bucket);
  }

  // 4. Upsert nodes с позициями
  const slugToId = new Map<string, string>();
  for (const [level, nodesInLevel] of byLevel.entries()) {
    nodesInLevel.forEach((n, idx) => {
      const pos = positionForLevel(level, idx);
      // Замыкание Promise через async-await — выносим в for/of цикл
      // (sequential inserts чтобы не перегружать pooler).
      (n as typeof n & { _pos?: { x: number; y: number } })._pos = pos;
    });
  }

  for (const n of loaded) {
    const pos = (n as typeof n & { _pos: { x: number; y: number } })._pos;
    const existing = await db
      .select({ id: nodesTable.id })
      .from(nodesTable)
      .where(and(eq(nodesTable.roleId, role.id), eq(nodesTable.slug, n.slug)))
      .limit(1);
    let id = existing[0]?.id;
    if (id) {
      await db
        .update(nodesTable)
        .set({
          title: n.title,
          summary: n.summary,
          positionX: pos.x,
          positionY: pos.y,
          estimatedMinutes: n.estimatedMinutes,
        })
        .where(eq(nodesTable.id, id));
    } else {
      const [inserted] = await db
        .insert(nodesTable)
        .values({
          roleId: role.id,
          slug: n.slug,
          title: n.title,
          summary: n.summary,
          positionX: pos.x,
          positionY: pos.y,
          estimatedMinutes: n.estimatedMinutes,
        })
        .returning();
      if (!inserted) throw new Error(`Failed to insert node ${n.slug}`);
      id = inserted.id;
    }
    slugToId.set(n.slug, id);
    stats.nodesUpserted += 1;
  }

  // 5. Upsert prereq edges. Frontmatter.prerequisites = explicit list of slugs.
  // Если поле пустое — ничего не делаем (нет линейного auto-link, чтобы
  // не было сюрпризов).
  for (const n of loaded) {
    const nodeId = slugToId.get(n.slug);
    if (!nodeId) continue;
    for (const prereqSlug of n.prerequisites) {
      const prereqId = slugToId.get(prereqSlug);
      if (!prereqId) {
        console.warn(
          `  ⚠ ${roleSlug}/${n.slug}: prereq "${prereqSlug}" не найден`,
        );
        continue;
      }
      await db
        .insert(nodePrerequisites)
        .values({ nodeId, prerequisiteNodeId: prereqId })
        .onConflictDoNothing();
      stats.edgesUpserted += 1;
    }
  }

  // 6. Sync flashcards для каждого узла
  for (const n of loaded) {
    const nodeId = slugToId.get(n.slug);
    if (!nodeId) continue;
    await syncFlashcardsForNode(db, nodeId, n.flashcards, stats);
  }
}

/**
 * Cards-only sync (legacy путь): только синхронизация flashcards.
 * Используется для старых ролей без `_role.json`.
 */
async function cardsOnlySyncRole(
  db: ReturnType<typeof drizzle>,
  roleSlug: string,
  stats: SyncStats,
): Promise<void> {
  const role = await db
    .select({ id: rolesTable.id })
    .from(rolesTable)
    .where(eq(rolesTable.slug, roleSlug))
    .limit(1)
    .then((r) => r[0]);
  if (!role) {
    console.warn(
      `· role "${roleSlug}" has MDX but no DB row and no _role.json — run db:seed or add _role.json.`,
    );
    return;
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
    await syncFlashcardsForNode(db, node.id, frontmatter.flashcards, stats);
  }
}

/**
 * Sync flashcards конкретного узла. Идемпотентно: insert новых, update
 * существующих с тем же prompt но новым ответом, delete тех, чьего prompt
 * больше нет в MDX (cascade на user_card_state).
 */
async function syncFlashcardsForNode(
  db: ReturnType<typeof drizzle>,
  nodeId: string,
  flashcards: { front: string; back: string }[],
  stats: SyncStats,
): Promise<void> {
  const mdxPrompts = flashcards.map((f) => f.front);

  const existing = await db
    .select({
      id: skillCards.id,
      prompt: skillCards.prompt,
      answerMarkdown: skillCards.answerMarkdown,
    })
    .from(skillCards)
    .where(eq(skillCards.nodeId, nodeId));
  const existingByPrompt = new Map(existing.map((r) => [r.prompt, r] as const));

  for (const card of flashcards) {
    const hit = existingByPrompt.get(card.front);
    if (!hit) {
      await db.insert(skillCards).values({
        nodeId,
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

  const idsToKeep = existing
    .filter((r) => mdxPrompts.includes(r.prompt))
    .map((r) => r.id);
  if (mdxPrompts.length === 0) {
    const stale = await db
      .delete(skillCards)
      .where(eq(skillCards.nodeId, nodeId))
      .returning({ id: skillCards.id });
    stats.cardsDeleted += stale.length;
  } else if (idsToKeep.length > 0) {
    const stale = await db
      .delete(skillCards)
      .where(
        and(eq(skillCards.nodeId, nodeId), notInArray(skillCards.id, idsToKeep)),
      )
      .returning({ id: skillCards.id });
    stats.cardsDeleted += stale.length;
  } else {
    const stale = await db
      .delete(skillCards)
      .where(
        and(
          eq(skillCards.nodeId, nodeId),
          inArray(skillCards.id, existing.map((r) => r.id)),
        ),
      )
      .returning({ id: skillCards.id });
    stats.cardsDeleted += stale.length;
  }
}
