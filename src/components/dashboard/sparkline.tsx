interface SparklineProps {
  data: { day: string; count: number }[];
  width?: number;
  height?: number;
}

/**
 * Tiny SVG sparkline. We build a polyline + filled area path from the
 * point series; no chart library. Each point also renders as a circle so
 * the chart still makes sense on series of length 1.
 */
export function Sparkline({ data, width = 240, height = 56 }: SparklineProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex h-14 items-center justify-center rounded-md border bg-muted/20 text-xs text-muted-foreground"
        data-testid="sparkline-empty"
      >
        No activity yet.
      </div>
    );
  }

  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const padX = 4;
  const padY = 4;
  const usableW = width - padX * 2;
  const usableH = height - padY * 2;
  const stepX = data.length === 1 ? 0 : usableW / (data.length - 1);

  const points = data.map((d, i) => {
    const x = padX + i * stepX;
    const y = padY + usableH - (d.count / maxCount) * usableH;
    return { x, y, d };
  });

  const pointsStr = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPath =
    `M ${points[0]!.x},${height - padY}` +
    " L " +
    points.map((p) => `${p.x},${p.y}`).join(" L ") +
    ` L ${points[points.length - 1]!.x},${height - padY} Z`;

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label="Activity over the last 7 days"
      data-testid="sparkline"
      className="overflow-visible"
    >
      <path d={areaPath} className="fill-primary/10" />
      <polyline
        points={pointsStr}
        fill="none"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="stroke-primary"
      />
      {points.map((p) => (
        <circle
          key={p.d.day}
          cx={p.x}
          cy={p.y}
          r={p.d.count > 0 ? 2.5 : 1.5}
          className={p.d.count > 0 ? "fill-primary" : "fill-muted-foreground"}
        >
          <title>{`${p.d.day}: ${p.d.count} event${p.d.count === 1 ? "" : "s"}`}</title>
        </circle>
      ))}
      {/* Last bucket axis ticker — small text under the rightmost point. */}
      <text
        x={width - padX}
        y={height - 0}
        textAnchor="end"
        className="fill-muted-foreground text-[9px]"
      >
        today
      </text>
    </svg>
  );
}
