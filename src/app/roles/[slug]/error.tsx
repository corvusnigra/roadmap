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
        <h2 className="text-lg font-semibold">Не удалось загрузить карту</h2>
        <p className="text-sm text-muted-foreground">
          Что-то пошло не так при отрисовке. Попробуйте ещё раз или вернитесь на главную.
        </p>
        <div className="flex justify-center gap-2">
          <Button onClick={() => reset()}>Попробовать снова</Button>
        </div>
      </div>
    </div>
  );
}
