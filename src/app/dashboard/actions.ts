"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { profiles, roles as rolesTable } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SLUG_REGEX = /^[a-z0-9-]+$/;

const setActiveRoleInput = z.object({
  roleSlug: z.string().regex(SLUG_REGEX),
});

/**
 * Set the user's active role. Validates that the slug points at a real,
 * published role so a malicious form payload can't park the user on a
 * non-existent or draft role. Revalidates `/dashboard` so the canvas
 * refreshes on next render.
 */
export async function setActiveRole(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Не аутентифицирован.");
  }

  const parsed = setActiveRoleInput.safeParse({
    roleSlug: formData.get("roleSlug"),
  });
  if (!parsed.success) {
    throw new Error("Некорректный slug роли.");
  }

  const role = await db
    .select({ slug: rolesTable.slug, status: rolesTable.status })
    .from(rolesTable)
    .where(eq(rolesTable.slug, parsed.data.roleSlug))
    .limit(1)
    .then((r) => r[0]);

  if (!role || role.status !== "published") {
    throw new Error(`Роль "${parsed.data.roleSlug}" недоступна.`);
  }

  await db
    .update(profiles)
    .set({ activeRoleSlug: role.slug })
    .where(eq(profiles.id, user.id));

  revalidatePath("/dashboard");
}
