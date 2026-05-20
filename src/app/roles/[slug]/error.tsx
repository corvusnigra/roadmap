"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function RoadmapError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Roadmap render failed:", error);
  }, [error]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center px-4">
      <div className="max-w-md space-y-3 text-center">
        <h2 className="text-lg font-semibold">Roadmap failed to load</h2>
        <p className="text-sm text-muted-foreground">
          Something went wrong while rendering the canvas. Try again, or head back home.
        </p>
        <div className="flex justify-center gap-2">
          <Button onClick={() => reset()}>Try again</Button>
        </div>
      </div>
    </div>
  );
}
