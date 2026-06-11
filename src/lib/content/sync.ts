/**
 * MDX-first content sync. Два режима работы:
 *
 *   Режим 1 — Full sync (для ролей с `_role.json` в папке):
 *     Upsert роль + узлы + prereq edges + skill_cards из MDX.
 *     Нет нужды в <role>-curriculum.ts или регистрации в db/seed.ts.
 *     Drop files in src/content/roles/<slug>/, run `pnpm content:sync`.
 *
 *   Режим 2 — Cards-only sync (для старых ролей без `_role.json`):
 *     Только синхронизация flashcards и MCQ из MDX в skill_cards.
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
  nodesDeleted: number;
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
    nodesDeleted: 0,
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
 * затем синхронизирует карточки (flashcard + mcq). Идемпотентно.
 * После upsert удаляет DB-узлы, для которых MDX-файл исчез — FK cascade
 * чистит skill_cards, edges, progress.
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
    masteryQuiz: { prompt: string; options: string[]; answerIndex: number; explanation: string }[];
    practice: Array<{ kind: string; prompt?: string; options?: string[]; answerIndex?: number; explanation?: string }>;
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
      masteryQuiz: frontmatter.masteryQuiz,
      practice: frontmatter.practice,
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

  // 4b. Удаляем DB-узлы, чьи MDX-файлы исчезли.
  // FK cascade (skill_cards, node_prerequisites, user_node_progress) чистит
  // зависимые строки автоматически.
  const mdxSlugSet = new Set(loaded.map((n) => n.slug));
  const dbNodes = await db
    .select({ id: nodesTable.id, slug: nodesTable.slug })
    .from(nodesTable)
    .where(eq(nodesTable.roleId, role.id));
  const orphanNodes = dbNodes.filter((n) => !mdxSlugSet.has(n.slug));
  if (orphanNodes.length > 0) {
    const orphanIds = orphanNodes.map((n) => n.id);
    console.warn(
      `⚠ ${roleSlug}: удаляем ${orphanNodes.length} orphan node(s) без MDX: ${orphanNodes.map((n) => n.slug).join(", ")}`,
    );
    await db.delete(nodesTable).where(inArray(nodesTable.id, orphanIds));
    stats.nodesDeleted += orphanNodes.length;
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

  // 6. Sync skill_cards (flashcard + mcq) для каждого узла
  for (const n of loaded) {
    const nodeId = slugToId.get(n.slug);
    if (!nodeId) continue;
    const allCards = projectMdxToCards(n.flashcards, n.masteryQuiz, n.practice);
    await syncCardsForNode(db, nodeId, allCards, stats);
  }
}

/**
 * Cards-only sync (legacy путь): только синхронизация flashcards + mcq.
 * Используется для старых ролей без `_role.json`.
 *
 * ВАЖНО: поиск узла обязательно scoped по role_id, потому что slug уникален
 * только внутри роли (см. UNIQUE(role_id, slug) в schema.ts). Без этого
 * cross-role коллизия slug может привести к перезаписи карточек чужого узла.
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
    // Ищем узел по (role_id, slug) — не просто по slug, чтобы не попасть
    // на одноимённый узел другой роли.
    const node = await db
      .select({ id: nodesTable.id })
      .from(nodesTable)
      .where(
        and(eq(nodesTable.roleId, role.id), eq(nodesTable.slug, nodeSlug)),
      )
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
    const allCards = projectMdxToCards(
      frontmatter.flashcards,
      frontmatter.masteryQuiz,
      frontmatter.practice,
    );
    await syncCardsForNode(db, node.id, allCards, stats);
  }
}

// ---------- Проекция MDX → карточки ----------

export interface CardInput {
  prompt: string;
  answerMarkdown: string;
  kind: "flashcard" | "mcq";
}

/**
 * Проецирует frontmatter MDX-узла в плоский список CardInput.
 *
 * Правила форматирования MCQ-ответа (идентично scripts/seed-java-middle-prod.mjs
 * и scripts/seed-java-cards-only.mjs):
 *   - список вариантов, правильный жирным + ✓
 *   - пустая строка, затем explanation
 *
 * Эта функция — единый источник правды для form. Экспортирована для тестов.
 */
export function projectMdxToCards(
  flashcards: { front: string; back: string }[],
  masteryQuiz: { prompt: string; options: string[]; answerIndex: number; explanation: string }[],
  practice: Array<{
    kind: string;
    prompt?: string;
    options?: string[];
    answerIndex?: number;
    explanation?: string;
  }>,
): CardInput[] {
  const result: CardInput[] = [];

  // Flashcards
  for (const c of flashcards) {
    result.push({ prompt: c.front, answerMarkdown: c.back, kind: "flashcard" });
  }

  // Mastery quiz MCQ
  for (const m of masteryQuiz) {
    result.push({
      prompt: m.prompt,
      answerMarkdown: formatMcqAnswer(m.options, m.answerIndex, m.explanation),
      kind: "mcq",
    });
  }

  // Practice MCQ (только kind=mcq; code-items пропускаем)
  for (const p of practice) {
    if (p.kind !== "mcq") continue;
    if (!p.prompt || !p.options || p.answerIndex === undefined || !p.explanation) continue;
    result.push({
      prompt: p.prompt,
      answerMarkdown: formatMcqAnswer(p.options, p.answerIndex, p.explanation),
      kind: "mcq",
    });
  }

  return result;
}

/**
 * Форматирует ответ MCQ в Markdown.
 * Правильный вариант помечается жирным + ✓; остальные — простой li.
 * Затем через пустую строку идёт explanation.
 *
 * Пример:
 *   - Неверный вариант
 *   - **Верный вариант** ✓
 *   - Неверный вариант
 *
 *   Explanation text.
 */
export function formatMcqAnswer(
  options: string[],
  answerIndex: number,
  explanation: string,
): string {
  const opts = options
    .map((o, i) => (i === answerIndex ? `**${o}** ✓` : o))
    .join("\n- ");
  return `- ${opts}\n\n${explanation}`;
}

/**
 * Sync skill_cards конкретного узла. Идемпотентно: insert новых, update
 * существующих с тем же prompt+kind но новым ответом, delete тех, чьего
 * prompt+kind больше нет в MDX (cascade на user_card_state).
 *
 * Ключ идемпотентности — (nodeId, prompt, kind). С миграцией 0009 на этом
 * сочетании стоит UNIQUE constraint, что предотвращает дубли при параллельных
 * прогонах.
 */
async function syncCardsForNode(
  db: ReturnType<typeof drizzle>,
  nodeId: string,
  cards: CardInput[],
  stats: SyncStats,
): Promise<void> {
  const existing = await db
    .select({
      id: skillCards.id,
      prompt: skillCards.prompt,
      kind: skillCards.kind,
      answerMarkdown: skillCards.answerMarkdown,
    })
    .from(skillCards)
    .where(eq(skillCards.nodeId, nodeId));

  // Ключ — prompt + kind (unique per node).
  // Используем явный Map<string, ...> чтобы избежать template-literal type mismatch
  // при .get(key) где key — plain string.
  const existingByKey = new Map<string, typeof existing[number]>(
    existing.map((r) => [`${r.kind}::${r.prompt}`, r]),
  );
  const mdxKeys = cards.map((c) => `${c.kind}::${c.prompt}`);

  for (const card of cards) {
    const key = `${card.kind}::${card.prompt}`;
    const hit = existingByKey.get(key);
    if (!hit) {
      await db.insert(skillCards).values({
        nodeId,
        prompt: card.prompt,
        answerMarkdown: card.answerMarkdown,
        kind: card.kind,
      });
      stats.cardsInserted += 1;
    } else if (hit.answerMarkdown !== card.answerMarkdown) {
      await db
        .update(skillCards)
        .set({ answerMarkdown: card.answerMarkdown })
        .where(eq(skillCards.id, hit.id));
      stats.cardsUpdated += 1;
    }
  }

  const idsToKeep = existing
    .filter((r) => mdxKeys.includes(`${r.kind}::${r.prompt}`))
    .map((r) => r.id);
  if (mdxKeys.length === 0) {
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
