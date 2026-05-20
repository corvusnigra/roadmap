interface ProgressRingProps {
  /** 0..1 fraction. */
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

/**
 * Small dependency-free SVG ring. Recharts/d3 are overkill for one shape.
 */
export function ProgressRing({
  value,
  size = 96,
  strokeWidth = 10,
  label,
}: ProgressRingProps) {
  const safe = Math.max(0, Math.min(1, value));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - safe);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-label={label ?? `${Math.round(safe * 100)}% complete`}
      data-testid="progress-ring"
      data-value={Math.round(safe * 100)}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="stroke-primary transition-all"
        />
      </svg>
      <span className="absolute text-sm font-semibold tabular-nums">
        {Math.round(safe * 100)}%
      </span>
    </div>
  );
}
