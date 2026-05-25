"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setActiveRole } from "@/app/dashboard/actions";
import { cn } from "@/lib/utils";

export interface RoleOption {
  slug: string;
  title: string;
}

interface RoleSwitcherProps {
  options: RoleOption[];
  activeSlug: string;
}

/**
 * Гостевой switcher (DEMO_MODE без auth): не пишет в profiles, а просто
 * перемещает дашборд на `?role=<slug>`. Серверный компонент дашборда
 * читает этот параметр и выбирает активную роль из URL вместо profile.
 *
 * Зачем не reuse основной RoleSwitcher: тот шлёт form action `setActiveRole`,
 * который требует `auth.getUser()`; для гостя он бы отвалился с 401.
 */
export function GuestRoleSwitcher({ options, activeSlug }: RoleSwitcherProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (options.length <= 1) return null;

  return (
    <>
      <label className="sr-only" htmlFor="role-switcher-guest">
        Активная роль (демо)
      </label>
      <select
        key={activeSlug}
        id="role-switcher-guest"
        defaultValue={activeSlug}
        disabled={pending}
        onChange={(e) => {
          const slug = e.currentTarget.value;
          startTransition(() => {
            router.push(`/dashboard?role=${encodeURIComponent(slug)}`);
          });
        }}
        className={cn(
          "h-8 cursor-pointer rounded-md border border-input bg-background px-2 text-xs",
          "focus:outline-none focus:ring-1 focus:ring-ring",
          pending && "opacity-60",
        )}
        data-testid="role-switcher-guest"
      >
        {options.map((o) => (
          <option key={o.slug} value={o.slug}>
            {o.title}
          </option>
        ))}
      </select>
    </>
  );
}

/**
 * Native <select> wrapped in a server-action form. Submitting on change keeps
 * the wire format simple (a form payload), and revalidatePath in the action
 * refreshes the dashboard with the new role's canvas.
 */
export function RoleSwitcher({ options, activeSlug }: RoleSwitcherProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [pending, startTransition] = useTransition();

  if (options.length <= 1) {
    return null;
  }

  return (
    <form ref={formRef} action={setActiveRole} className="inline-block">
      <label className="sr-only" htmlFor="role-switcher">
        Активная роль
      </label>
      <select
        // `key` forces React to re-mount the <select> whenever activeSlug
        // changes from the server — without it `defaultValue` would stick
        // to the value at first render and ignore subsequent revalidations
        // (code-review L2).
        key={activeSlug}
        id="role-switcher"
        name="roleSlug"
        defaultValue={activeSlug}
        disabled={pending}
        onChange={(e) => {
          // Submit synchronously so the server action runs; wrap in
          // useTransition so React keeps the UI responsive.
          const form = e.currentTarget.form;
          if (!form) return;
          startTransition(() => form.requestSubmit());
        }}
        className={cn(
          "h-8 cursor-pointer rounded-md border border-input bg-background px-2 text-xs",
          "focus:outline-none focus:ring-1 focus:ring-ring",
          pending && "opacity-60",
        )}
        data-testid="role-switcher"
      >
        {options.map((o) => (
          <option key={o.slug} value={o.slug}>
            {o.title}
          </option>
        ))}
      </select>
    </form>
  );
}
