import { redirect } from "next/navigation";

/**
 * Signed-in users land here from /login → bounce to /dashboard which is the
 * real home. Middleware sends unauth users to /login before this even runs.
 */
export default function HomePage() {
  redirect("/dashboard");
}
