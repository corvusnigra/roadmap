"use client";

import { useRef, useTransition } from "react";

import { setExploreMode } from "@/app/dashboard/actions";
import { cn } from "@/lib/utils";

interface ExploreModeSwitchProps {
  enabled: boolean;
}

/**
 * Compact toggle для роли "куратор/владелец": снимает prereq-замки со всех
 * узлов канвы. Хранится в `profiles.explore_mode`, читается на сервере при
 * рендере страницы роли через `computeRoadmapView(..., { exploreMode })`.
 *
 * Сам хендлер — обычная server-action форма. `key={enabled}` гарантирует
 * пересоздание `<input>` при revalidatePath, чтобы UI не «прилипал» к
 * старому состоянию.
 */
export function ExploreModeSwitch({ enabled }: ExploreModeSwitchProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form ref={formRef} action={setExploreMode} className="inline-flex items-center gap-2">
      <input
        key={String(enabled)}
        type="hidden"
        name="enabled"
        value={enabled ? "off" : "on"}
      />
      <label
        htmlFor="explore-mode-switch"
        className="cursor-pointer text-xs text-muted-foreground select-none"
      >
        Исследовательский режим
      </label>
      <button
        id="explore-mode-switch"
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={pending}
        onClick={() => {
          const form = formRef.current;
          if (!form) return;
          startTransition(() => form.requestSubmit());
        }}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
          enabled ? "bg-prose-accent" : "bg-rule",
          pending && "opacity-60",
        )}
        data-testid="explore-mode-switch"
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform",
            "translate-y-[2px]",
            enabled ? "translate-x-[18px]" : "translate-x-[2px]",
          )}
          aria-hidden
        />
      </button>
    </form>
  );
}
