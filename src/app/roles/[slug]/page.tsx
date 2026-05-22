import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { DEMO_MODE } from "@/lib/auth/demo-mode";
import { db } from "@/lib/db";
import {
  nodePrerequisites,
  nodes as nodesTable,
  profiles,
  roles as rolesTable,
  userNodeProgress,
} from "@/db/schema";
import {
  computeRoadmapView,
  type RoadmapEdgeInput,
  type RoadmapNodeInput,
  type RoadmapProgressInput,
} from "@/lib/roadmap/status";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RoadmapCanvas } from "@/components/roadmap/canvas";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function RoleRoadmapPage({ params }: PageProps) {
  const { slug } = await params;

  const role = await db
    .select()
    .from(rolesTable)
    .where(eq(rolesTable.slug, slug))
    .limit(1)
    .then((rows) => rows[0]);

  if (!role) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // В демо-режиме гость без сессии — валидный посетитель. Рендерим граф
  // без per-user прогресса и форсим exploreMode=true, чтобы все узлы
  // были кликабельны.
  const isGuest = !user;
  if (isGuest && !DEMO_MODE) {
    notFound();
  }

  const nodeRows = await db
    .select({
      id: nodesTable.id,
      slug: nodesTable.slug,
      title: nodesTable.title,
      estimatedMinutes: nodesTable.estimatedMinutes,
      positionX: nodesTable.positionX,
      positionY: nodesTable.positionY,
    })
    .from(nodesTable)
    .where(eq(nodesTable.roleId, role.id));

  const nodeIds = nodeRows.map((n) => n.id);

  const [edgeRows, progressRows, profileRow] = await Promise.all([
    nodeIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            nodeId: nodePrerequisites.nodeId,
            prerequisiteNodeId: nodePrerequisites.prerequisiteNodeId,
          })
          .from(nodePrerequisites),
    user
      ? db
          .select({
            nodeId: userNodeProgress.nodeId,
            status: userNodeProgress.status,
          })
          .from(userNodeProgress)
          .where(eq(userNodeProgress.userId, user.id))
      : Promise.resolve([] as Array<{ nodeId: string; status: "locked" | "in_progress" | "mastered" }>),
    user
      ? db
          .select({ exploreMode: profiles.exploreMode })
          .from(profiles)
          .where(eq(profiles.id, user.id))
          .limit(1)
          .then((r) => r[0])
      : Promise.resolve(undefined),
  ]);
  // Гостю — всегда explore-режим: без замков, чтобы пощупать контент.
  const exploreMode = profileRow?.exploreMode ?? isGuest;

  // Drop edges that aren't part of this role's node set (defensive against
  // future cross-role references in node_prerequisites).
  const idSet = new Set(nodeIds);
  const ownEdges = edgeRows.filter(
    (e) => idSet.has(e.nodeId) && idSet.has(e.prerequisiteNodeId),
  );

  const view = computeRoadmapView(
    nodeRows satisfies RoadmapNodeInput[],
    ownEdges satisfies RoadmapEdgeInput[],
    progressRows satisfies RoadmapProgressInput[],
    { exploreMode },
  );

  return (
    <RoadmapCanvas
      roleSlug={slug}
      roleTitle={role.title}
      view={view}
      exploreMode={exploreMode}
    />
  );
}
