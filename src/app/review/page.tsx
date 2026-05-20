import { notFound } from "next/navigation";

import { getDueCards } from "@/lib/fsrs/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ReviewQueue } from "@/components/review/review-queue";

export default async function ReviewPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const dueCards = await getDueCards(user.id, 50);

  const items = dueCards.map((c) => ({
    cardId: c.cardId,
    prompt: c.prompt,
    answerMarkdown: c.answerMarkdown,
    nodeSlug: c.nodeSlug,
    nodeTitle: c.nodeTitle,
  }));

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Today&apos;s review</h1>
        <p className="text-sm text-muted-foreground">
          {items.length === 0
            ? "Nothing due right now — come back when more cards age in."
            : `${items.length} card${items.length === 1 ? "" : "s"} due across your roadmap.`}
        </p>
      </header>
      <ReviewQueue items={items} />
    </div>
  );
}
