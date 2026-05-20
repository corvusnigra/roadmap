export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-[calc(100vh-3.5rem)] items-center justify-center"
    >
      <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
        <div
          aria-hidden="true"
          className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-foreground"
        />
        <span>Loading roadmap…</span>
      </div>
    </div>
  );
}
