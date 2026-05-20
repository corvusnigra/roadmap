"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from "reactflow";
import "reactflow/dist/style.css";
import { toast } from "sonner";

import { Progress } from "@/components/ui/progress";
import {
  RoadmapNode,
  type RoadmapNodeData,
} from "@/components/roadmap/node";
import {
  isNodeUnlocked,
  type RoadmapView,
} from "@/lib/roadmap/status";

interface RoadmapCanvasProps {
  roleSlug: string;
  view: RoadmapView;
}

const nodeTypes = { roadmap: RoadmapNode };

export function RoadmapCanvas({ roleSlug, view }: RoadmapCanvasProps) {
  const router = useRouter();

  const flowNodes = useMemo<Node<RoadmapNodeData>[]>(
    () =>
      view.nodes.map((n) => ({
        id: n.id,
        type: "roadmap",
        position: { x: n.positionX, y: n.positionY },
        data: {
          slug: n.slug,
          title: n.title,
          estimatedMinutes: n.estimatedMinutes,
          status: n.status,
          unmetPrerequisiteTitles: n.unmetPrerequisiteTitles,
        },
      })),
    [view.nodes],
  );

  const flowEdges = useMemo<Edge[]>(
    () =>
      view.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        animated: false,
        style: { stroke: "hsl(var(--border))" },
      })),
    [view.edges],
  );

  const onNodeClick = useCallback<NodeMouseHandler>(
    (_event, clicked) => {
      const data = clicked.data as RoadmapNodeData;
      const enrichedNode = view.nodes.find((n) => n.id === clicked.id);
      if (!enrichedNode) return;

      if (!isNodeUnlocked(enrichedNode)) {
        toast.error("Locked", {
          description: `Finish: ${data.unmetPrerequisiteTitles.join(", ")}`,
        });
        return;
      }

      router.push(`/roles/${roleSlug}/nodes/${data.slug}`);
    },
    [router, roleSlug, view.nodes],
  );

  const { mastered, total } = view.totals;

  return (
    <div
      className="flex h-[calc(100vh-3.5rem)] flex-col"
      data-testid="roadmap-canvas"
    >
      <header className="border-b border-border bg-background/80 px-6 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              Frontend Developer roadmap
            </h1>
            <p className="text-xs text-muted-foreground">
              <span data-testid="progress-text">
                {mastered} of {total} mastered
              </span>
            </p>
          </div>
          <div className="w-48 max-w-full">
            <Progress value={mastered} max={Math.max(total, 1)} />
          </div>
        </div>
      </header>
      <div className="relative flex-1">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.2, minZoom: 0.4, maxZoom: 1.4 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}
