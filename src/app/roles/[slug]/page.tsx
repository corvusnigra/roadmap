import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  nodePrerequisites,
  nodes as nodesTable,
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

  // Middleware enforces auth on this route, so user is always present here,
  // but we guard anyway in case the page is rendered from an unauth context.
  if (!user) {
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

  const [edgeRows, progressRows] = await Promise.all([
    nodeIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            nodeId: nodePrerequisites.nodeId,
            prerequisiteNodeId: nodePrerequisites.prerequisiteNodeId,
          })
          .from(nodePrerequisites),
    db
      .select({
        nodeId: userNodeProgress.nodeId,
        status: userNodeProgress.status,
      })
      .from(userNodeProgress)
      .where(eq(userNodeProgress.userId, user.id)),
  ]);

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
  );

  return <RoadmapCanvas roleSlug={slug} roleTitle={role.title} view={view} />;
}
