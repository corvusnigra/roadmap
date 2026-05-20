import { createClient } from "@supabase/supabase-js";

/**
 * Insert (or update) a user_node_progress row for the test user so /review
 * has something to pull cards from. Bypasses RLS via the service role.
 */
export async function seedNodeProgress(
  email: string,
  nodeSlug: string,
  status: "in_progress" | "mastered",
): Promise<void> {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: list, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) throw listErr;
  const user = list.users.find((u) => u.email === email);
  if (!user) throw new Error(`No auth user with email ${email}`);

  const { data: node, error: nodeErr } = await admin
    .from("nodes")
    .select("id")
    .eq("slug", nodeSlug)
    .maybeSingle();
  if (nodeErr) throw nodeErr;
  if (!node) throw new Error(`No node with slug ${nodeSlug}`);

  const nodeId = (node as { id: string }).id;

  await admin
    .from("user_node_progress")
    .upsert(
      {
        user_id: user.id,
        node_id: nodeId,
        status,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,node_id" },
    );
}
