import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  nodes as nodesTable,
  roles as rolesTable,
  userEvents,
  userNodeProgress,
} from "@/db/schema";
import { ContentNotFoundError, loadNode } from "@/lib/content/loader";
import { loadExercise } from "@/lib/content/exercise-loader";
import { getDueCardsForNode } from "@/lib/fsrs/queries";
import type { PracticeCode } from "@/lib/content/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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

  const node = await db
    .select({ id: nodesTable.id, slug: nodesTable.slug, roleId: nodesTable.roleId })
    .from(nodesTable)
    .where(eq(nodesTable.slug, nodeSlug))
    .limit(1)
    .then((r) => r[0]);
  if (!node || node.roleId !== role.id) notFound();

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
  if (!user) notFound();

  const [progressRow, theoryReadRows, dueCards] = await Promise.all([
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
  ]);

  const initialProgress: InitialProgress = {
    status: progressRow[0]?.status ?? "locked",
    masteryScore: progressRow[0]?.masteryScore ?? null,
    theoryRead: theoryReadRows.length > 0,
  };

  // Pre-render the MDX as a Server Component subtree, then hand it to the
  // client view as a child — Next bridges RSC -> client component props.
  const theoryContent = (
    <MDXRemote
      source={loaded.source}
      options={{
        mdxOptions: {
          // Keep default remark/rehype plugins minimal for now; Phase 7 may
          // add syntax highlighting and Mermaid.
        },
      }}
    />
  );

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
      reinforcementCards={reinforcementCards}
      codeExercises={codeExercises}
    />
  );
}
