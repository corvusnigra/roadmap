import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowRight, Flame } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ExploreModeSwitch } from "@/components/dashboard/explore-mode-switch";
import { ProgressRing } from "@/components/dashboard/progress-ring";
import { RoleSwitcher } from "@/components/dashboard/role-switcher";
import { Sparkline } from "@/components/dashboard/sparkline";
import { signOut } from "@/app/login/actions";
import { db } from "@/lib/db";
import { profiles, roles as rolesTable } from "@/db/schema";
import { getDueCards } from "@/lib/fsrs/queries";
import {
  computeRoleProgress,
  getActivityByDay,
  getNextRecommendedNode,
  getStreak,
} from "@/lib/progress";
import { logEvent } from "@/lib/progress/transitions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { pluralRu } from "@/lib/i18n/plural";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const profile = await db
    .select({
      timezone: profiles.timezone,
      displayName: profiles.displayName,
      activeRoleSlug: profiles.activeRoleSlug,
      exploreMode: profiles.exploreMode,
    })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1)
    .then((r) => r[0]);
  const timezone = profile?.timezone ?? "UTC";
  const exploreMode = profile?.exploreMode ?? false;

  // All published roles for the role-switcher.
  const availableRoles = await db
    .select({ id: rolesTable.id, slug: rolesTable.slug, title: rolesTable.title })
    .from(rolesTable)
    .where(eq(rolesTable.status, "published"));

  // Active role is whatever the profile says, falling back to the first
  // available published role. If neither exists we 404 — the seed should
  // always provide at least one role.
  const activeSlug = profile?.activeRoleSlug ?? availableRoles[0]?.slug;
  const role =
    availableRoles.find((r) => r.slug === activeSlug) ?? availableRoles[0];
  if (!role) notFound();

  const [progress, nextNode, streak, activity, dueCards] = await Promise.all([
    computeRoleProgress(user.id, role.id),
    getNextRecommendedNode(user.id, role.id),
    getStreak(user.id, timezone),
    getActivityByDay(user.id, timezone, 7),
    getDueCards(user.id, 50),
  ]);

  const masteryRatio =
    progress.total === 0 ? 0 : progress.mastered / progress.total;
  const dueCount = dueCards.length;
  const totalEvents = activity.reduce((n, d) => n + d.count, 0);

  // Fire-and-forget "session_started" — appears in user_events + PostHog.
  await logEvent(user.id, "session_started", "role", role.id, {
    dueCount,
    streak,
  });

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Текущая роль:
            </p>
            <RoleSwitcher options={availableRoles} activeSlug={role.slug} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            С возвращением
            {profile?.displayName ? `, ${profile.displayName}` : ""}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <ExploreModeSwitch enabled={exploreMode} />
          <form action={signOut}>
            <Button variant="ghost" size="sm" type="submit">
              Выйти
            </Button>
          </form>
        </div>
      </header>

      {/* Today's session card */}
      <section
        className="rounded-xl border bg-card p-5"
        data-testid="todays-session"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Сегодняшняя сессия
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border bg-background/60 p-4">
            <div>
              <p className="text-2xl font-semibold tabular-nums">{dueCount}</p>
              <p className="text-xs text-muted-foreground">
                {pluralRu(dueCount, [
                  "карточка на повторение",
                  "карточки на повторение",
                  "карточек на повторение",
                ])}
              </p>
            </div>
            <Link
              href="/review"
              className={buttonVariants({
                variant: dueCount > 0 ? "default" : "outline",
                size: "sm",
              })}
              data-testid="open-review"
            >
              Повторить <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="flex items-center justify-between rounded-lg border bg-background/60 p-4">
            <div>
              <p className="text-sm font-medium" data-testid="next-node-title">
                {nextNode ? nextNode.title : "Всё пройдено"}
              </p>
              <p className="text-xs text-muted-foreground">
                {nextNode
                  ? "Рекомендуемый следующий узел"
                  : "Доступных узлов больше нет"}
              </p>
            </div>
            {nextNode ? (
              <Link
                href={
                  `/roles/${role.slug}/nodes/${nextNode.slug}` as `/roles/${string}/nodes/${string}`
                }
                className={buttonVariants({ variant: "default", size: "sm" })}
                data-testid="open-next-node"
              >
                Открыть <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            ) : (
              <Badge variant="success">Освоено</Badge>
            )}
          </div>
        </div>
      </section>

      {/* Progress + streak + sparkline */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div
          className="flex flex-col items-center gap-2 rounded-xl border bg-card p-5"
          data-testid="progress-card"
        >
          <ProgressRing value={masteryRatio} />
          <p className="text-sm font-medium tabular-nums">
            <span data-testid="progress-mastered">{progress.mastered}</span> из{" "}
            <span data-testid="progress-total">{progress.total}</span> освоено
          </p>
          <p className="text-xs text-muted-foreground">
            в процессе: {progress.inProgress} · закрыто: {progress.locked}
          </p>
        </div>
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-xl border bg-card p-5"
          data-testid="streak-card"
        >
          <div className="flex items-center gap-2">
            <Flame className="h-6 w-6 text-orange-500" />
            <span
              className="text-3xl font-semibold tabular-nums"
              data-testid="streak-count"
            >
              {streak}
            </span>
          </div>
          <p className="text-sm font-medium">
            {pluralRu(streak, ["день подряд", "дня подряд", "дней подряд"])}
          </p>
          <p className="text-xs text-muted-foreground">
            Любая активность сохраняет серию.
          </p>
        </div>
        <div
          className="flex flex-col gap-2 rounded-xl border bg-card p-5"
          data-testid="sparkline-card"
        >
          <p className="text-sm font-medium">За 7 дней</p>
          <Sparkline data={activity} />
          <p className="text-xs text-muted-foreground">
            всего событий: {totalEvents}
          </p>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Дорожная карта
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Полный граф для роли «{role.title}» — статусы всех узлов: закрыт /
          доступен / освоен.
        </p>
        <div className="mt-3">
          <Link
            href={`/roles/${role.slug}` as `/roles/${string}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
            data-testid="open-roadmap"
          >
            Открыть карту <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    </main>
  );
}
