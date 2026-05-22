import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { and, asc, eq } from "drizzle-orm";

import { DEMO_MODE } from "@/lib/auth/demo-mode";
import { db } from "@/lib/db";
import {
  nodes as nodesTable,
  roles as rolesTable,
  tutorMessages,
  userEvents,
  userNodeProgress,
} from "@/db/schema";
import type { TutorTurn } from "@/app/api/tutor/types";
import { ContentNotFoundError, loadNode } from "@/lib/content/loader";
import { loadExercise } from "@/lib/content/exercise-loader";
import { getDueCardsForNode } from "@/lib/fsrs/queries";
import { logEvent } from "@/lib/progress/transitions";
import type { PracticeCode } from "@/lib/content/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  extractTocItems,
  mdxComponents,
} from "@/components/learn/mdx-components";
import {
  NodeView,
  type InitialProgress,
  type LoadedCodeExercise,
} from "@/components/learn/node-view";

interface PageProps {
  params: Promise<{ slug: string; nodeSlug: string }>;
}

export default async function NodePage({ params }: PageProps) {
  const { slug, nodeSlug } = await params;

  const role = await db
    .select({ id: rolesTable.id, slug: rolesTable.slug })
    .from(rolesTable)
    .where(eq(rolesTable.slug, slug))
    .limit(1)
    .then((r) => r[0]);
  if (!role) notFound();

  // Scope by both roleId and slug — without the roleId predicate, LIMIT 1
  // could return a node from a sibling role on slug collision (code-review
  // H1). The DB-level UNIQUE(role_id, slug) constraint also rules out
  // duplicate slugs within a role, so this is safe.
  const node = await db
    .select({ id: nodesTable.id, slug: nodesTable.slug, roleId: nodesTable.roleId })
    .from(nodesTable)
    .where(and(eq(nodesTable.roleId, role.id), eq(nodesTable.slug, nodeSlug)))
    .limit(1)
    .then((r) => r[0]);
  if (!node) notFound();

  let loaded;
  try {
    loaded = await loadNode(slug, nodeSlug);
  } catch (err) {
    if (err instanceof ContentNotFoundError) notFound();
    throw err;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isGuest = !user;
  if (isGuest && !DEMO_MODE) notFound();

  if (user) {
    await logEvent(user.id, "node_opened", "node", node.id, {
      roleSlug: slug,
      nodeSlug,
    });
  }

  const [progressRow, theoryReadRows, dueCards, tutorRows] = user
    ? await Promise.all([
        db
          .select({
            status: userNodeProgress.status,
            masteryScore: userNodeProgress.masteryScore,
          })
          .from(userNodeProgress)
          .where(
            and(
              eq(userNodeProgress.userId, user.id),
              eq(userNodeProgress.nodeId, node.id),
            ),
          )
          .limit(1),
        db
          .select({ id: userEvents.id })
          .from(userEvents)
          .where(
            and(
              eq(userEvents.userId, user.id),
              eq(userEvents.verb, "theory_read"),
              eq(userEvents.objectId, node.id),
            ),
          )
          .limit(1),
        getDueCardsForNode(user.id, node.id, 10),
        db
          .select({
            id: tutorMessages.id,
            role: tutorMessages.role,
            content: tutorMessages.content,
            createdAt: tutorMessages.createdAt,
          })
          .from(tutorMessages)
          .where(
            and(
              eq(tutorMessages.userId, user.id),
              eq(tutorMessages.nodeId, node.id),
            ),
          )
          .orderBy(asc(tutorMessages.createdAt))
          .limit(50),
      ])
    : ([
        // Гость: пустой прогресс, никакой истории, нет due cards.
        [] as Array<{ status: "locked" | "in_progress" | "mastered"; masteryScore: number | null }>,
        [] as Array<{ id: string }>,
        [] as Awaited<ReturnType<typeof getDueCardsForNode>>,
        [] as Array<{
          id: string;
          role: "user" | "assistant" | "system";
          content: string;
          createdAt: Date;
        }>,
      ] as const);

  const tutorHistory: TutorTurn[] = tutorRows.map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  }));

  const initialProgress: InitialProgress = {
    status: progressRow[0]?.status ?? "locked",
    masteryScore: progressRow[0]?.masteryScore ?? null,
    theoryRead: theoryReadRows.length > 0,
  };

  // Pre-render the MDX as a Server Component subtree, then hand it to the
  // client view as a child — Next bridges RSC -> client component props.
  // `mdxComponents` injects editorial typography (counter-numbered H2s,
  // serif body, styled tables) plus the `<Callout>` component used inline.
  const theoryContent = (
    <MDXRemote
      source={loaded.source}
      components={mdxComponents}
      options={{
        mdxOptions: {
          // remark-gfm enables GitHub-flavored markdown: tables, task lists,
          // strikethrough, autolinks. Without it MDX renders `| col | col |`
          // as literal text instead of a <table>.
          remarkPlugins: [remarkGfm],
        },
      }}
    />
  );

  // Server-side TOC: parse H2 lines out of the raw MDX (ignoring fenced
  // code blocks). Ids match what the `h2` MDX override generates so anchors
  // line up.
  const tocItems = extractTocItems(loaded.source);

  const reinforcementCards = dueCards.map((c) => ({
    cardId: c.cardId,
    prompt: c.prompt,
    answerMarkdown: c.answerMarkdown,
  }));

  // Load starter/tests for each `kind: 'code'` practice item so the Sandpack
  // component can render without any client-side fetches.
  const codeItems = loaded.frontmatter.practice
    .map((item, idx) => ({ item, idx }))
    .filter(
      (
        x,
      ): x is { item: PracticeCode; idx: number } =>
        x.item.kind === "code",
    );
  const codeExercises: LoadedCodeExercise[] = await Promise.all(
    codeItems.map(async ({ item, idx }) => {
      const ex = await loadExercise(slug, `code:${idx}`, item);
      return {
        itemKey: ex.itemKey,
        practiceIndex: idx,
        prompt: ex.prompt,
        language: ex.language,
        starterCode: ex.starterCode,
        testsCode: ex.testsCode,
      };
    }),
  );

  return (
    <NodeView
      roleSlug={slug}
      frontmatter={loaded.frontmatter}
      initialProgress={initialProgress}
      theoryContent={theoryContent}
      tocItems={tocItems}
      reinforcementCards={reinforcementCards}
      codeExercises={codeExercises}
      tutorHistory={tutorHistory}
    />
  );
}
