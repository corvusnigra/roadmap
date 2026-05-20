import { createClient } from "@supabase/supabase-js";

/**
 * Wipe per-user state so a test starts from "no progress, no events". Uses
 * the service-role client which bypasses RLS. Targets exactly one user by
 * email and is a no-op if the user doesn't exist yet (auth.setup creates
 * them once per Playwright run).
 */
export async function resetUserState(email: string): Promise<void> {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required to reset e2e user state.",
    );
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: list, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) throw listErr;
  const user = list.users.find((u) => u.email === email);
  if (!user) return;

  // Delete all rows the user owns. RLS would block this if we used the
  // anon client, but service_role bypasses it.
  await Promise.all([
    admin.from("user_node_progress").delete().eq("user_id", user.id),
    admin.from("user_events").delete().eq("user_id", user.id),
    admin.from("user_card_state").delete().eq("user_id", user.id),
  ]);
}
