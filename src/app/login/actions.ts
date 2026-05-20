"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const signInSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  next: z
    .string()
    .startsWith("/", "Redirect target must be an internal path.")
    .optional(),
});

async function buildRedirectUrl(next: string | undefined): Promise<string> {
  const requestHeaders = await headers();
  const origin =
    requestHeaders.get("origin") ??
    `http://${requestHeaders.get("host") ?? "localhost:3000"}`;
  const url = new URL("/auth/callback", origin);
  if (next) url.searchParams.set("next", next);
  return url.toString();
}

export async function signInWithEmail(formData: FormData) {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    const message = firstError?.message ?? "Invalid input.";
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: await buildRedirectUrl(parsed.data.next),
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/login?sent=1`);
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
