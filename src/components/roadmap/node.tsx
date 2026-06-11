"use client";

import { Check, Lock } from "lucide-react";
import { Handle, Position, type NodeProps } from "reactflow";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { NodeStatus } from "@/lib/roadmap/status";

export interface RoadmapNodeData {
  slug: string;
  title: string;
  estimatedMinutes: number;
  status: NodeStatus;
  unmetPrerequisiteTitles: string[];
}

const STATUS_STYLES: Record<
  NodeStatus,
  { container: string; label: string; badgeVariant: "secondary" | "success" | "muted" }
> = {
  mastered: {
    container:
      "border-emerald-500 bg-emerald-500/5 text-foreground shadow-sm hover:bg-emerald-500/10",
    label: "Освоено",
    badgeVariant: "success",
  },
  in_progress: {
    container:
      "border-primary bg-primary/5 text-foreground shadow-sm hover:bg-primary/10",
    label: "В процессе",
    badgeVariant: "secondary",
  },
  locked: {
    container:
      "border-border bg-muted/40 text-muted-foreground hover:bg-muted/60",
    label: "",
    badgeVariant: "muted",
  },
};

export function RoadmapNode({ data }: NodeProps<RoadmapNodeData>) {
  const isLocked = data.status === "locked" && data.unmetPrerequisiteTitles.length > 0;
  const isAvailable = data.status === "locked" && data.unmetPrerequisiteTitles.length === 0;
  const style = STATUS_STYLES[data.status];

  const badgeLabel = isLocked ? "Закрыто" : isAvailable ? "Доступно" : style.label;
  const tooltip = isLocked
    ? `Сначала пройдите: ${data.unmetPrerequisiteTitles.join(", ")}`
    : undefined;

  // Enter/Space → синтетический click, который всплывает до обёртки React Flow
  // и триггерит onNodeClick в canvas — узлы доступны с клавиатуры.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.currentTarget.click();
    }
  };

  const ariaLabel = [data.title, `${data.estimatedMinutes} мин`, badgeLabel, tooltip]
    .filter(Boolean)
    .join(". ");

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      title={tooltip}
      data-status={data.status}
      data-available={isAvailable ? "true" : "false"}
      data-node-slug={data.slug}
      className={cn(
        "w-[260px] cursor-pointer rounded-lg border-2 px-4 py-3 transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        style.container,
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-border" />
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold leading-tight">{data.title}</span>
        {data.status === "mastered" ? (
          <Check className="h-4 w-4 text-emerald-500" />
        ) : isLocked ? (
          <Lock className="h-4 w-4 text-muted-foreground" />
        ) : null}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">
          {data.estimatedMinutes} мин
        </span>
        <Badge variant={style.badgeVariant} className="px-1.5 py-0 text-[10px]">
          {badgeLabel}
        </Badge>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-border" />
    </div>
  );
}
