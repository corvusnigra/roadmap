import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Magic-link / OAuth callback. Supabase appends ?code=... when redirecting
 * back here; we exchange that code for an authenticated session (cookies set
 * via the server client), then forward the user to the original target.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next");
  const next = nextParam?.startsWith("/") ? nextParam : "/";

  if (!code) {
    const dest = url.clone();
    dest.pathname = "/login";
    dest.search = `?error=${encodeURIComponent("Missing auth code")}`;
    return NextResponse.redirect(dest);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const dest = url.clone();
    dest.pathname = "/login";
    dest.search = `?error=${encodeURIComponent(error.message)}`;
    return NextResponse.redirect(dest);
  }

  const dest = url.clone();
  dest.pathname = next;
  dest.search = "";
  return NextResponse.redirect(dest);
}
