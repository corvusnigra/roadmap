import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">RoleRoadmap MVP</h1>
      <p className="max-w-xl text-balance text-muted-foreground">
        Turn a job role into a visual, interactive knowledge graph with theory, practice, and
        spaced repetition.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/roles/frontend-developer" className={buttonVariants({ variant: "default" })}>
          Explore the Frontend Developer track
        </Link>
        <Button variant="outline">Take the tour</Button>
      </div>
    </main>
  );
}
