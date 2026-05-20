import Link from "next/link";

import { signOut } from "@/app/login/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">RoleRoadmap MVP</h1>
      <p className="max-w-xl text-balance text-muted-foreground">
        Turn a job role into a visual, interactive knowledge graph with theory, practice, and
        spaced repetition.
      </p>
      {user ? (
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{user.email}</span>
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/roles/frontend-developer" className={buttonVariants({ variant: "default" })}>
          Explore the Frontend Developer track
        </Link>
        <Button variant="outline">Take the tour</Button>
        {user ? (
          <form action={signOut}>
            <Button variant="ghost" type="submit">
              Sign out
            </Button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
