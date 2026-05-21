import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { signInWithEmail } from "./actions";

type SearchParams = {
  sent?: string;
  error?: string;
  next?: string;
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(params.next ?? "/");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Вход в RoleRoadmap</h1>
          <p className="text-sm text-muted-foreground">
            Мы отправим ссылку для входа на email. Локально — проверяйте{" "}
            <a
              href="http://127.0.0.1:54324"
              className="underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              Mailpit
            </a>
            .
          </p>
        </header>

        <form action={signInWithEmail} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
            {params.next ? (
              <input type="hidden" name="next" value={params.next} />
            ) : null}
          </div>
          <Button type="submit" className="w-full">
            Отправить ссылку
          </Button>
        </form>

        {params.sent ? (
          <p className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-300">
            Ссылка отправлена — проверьте почту (локально — Mailpit).
          </p>
        ) : null}
        {params.error ? (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {params.error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
