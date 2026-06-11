"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const signInSchema = z.object({
  email: z.string().email("Введите корректный email."),
  // Принимаем любую строку, точную валидацию делает safeRedirectPath —
  // это защищает от protocol-relative редиректов вида //evil.com.
  next: z.string().optional(),
});

async function buildRedirectUrl(next: string | undefined): Promise<string> {
  const requestHeaders = await headers();
  const origin =
    requestHeaders.get("origin") ??
    `http://${requestHeaders.get("host") ?? "localhost:3000"}`;
  const url = new URL("/auth/callback", origin);
  // safeRedirectPath отклоняет protocol-relative (//evil.com) и абсолютные URL.
  const safePath = safeRedirectPath(next);
  if (safePath !== "/") url.searchParams.set("next", safePath);
  return url.toString();
}

export async function signInWithEmail(formData: FormData) {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    const message = firstError?.message ?? "Некорректные данные.";
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
