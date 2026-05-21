import { notFound } from "next/navigation";

import { getDueCards } from "@/lib/fsrs/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ReviewQueue } from "@/components/review/review-queue";
import { pluralRu } from "@/lib/i18n/plural";

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
        <h1 className="text-2xl font-semibold tracking-tight">Повторение на сегодня</h1>
        <p className="text-sm text-muted-foreground">
          {items.length === 0
            ? "Сейчас нет карточек на повторение — возвращайтесь позже."
            : `На карте ${items.length} ${pluralRu(items.length, [
                "карточка",
                "карточки",
                "карточек",
              ])} на повторение.`}
        </p>
      </header>
      <ReviewQueue items={items} />
    </div>
  );
}
