import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Sister endpoint to `/auth/callback`. Receives `{ access_token,
 * refresh_token }` from the client-side hash bridge and installs the
 * session via the Supabase SSR client — which writes the auth cookies
 * onto the response, matching what `exchangeCodeForSession` does for
 * the PKCE flow.
 *
 * Kept POST-only so the tokens never appear in URL/Referer logs.
 */

const bodySchema = z.object({
  access_token: z.string().min(20),
  refresh_token: z.string().min(20),
});

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new NextResponse("Invalid JSON body", { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return new NextResponse("access_token and refresh_token required", {
      status: 400,
    });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.setSession({
    access_token: parsed.data.access_token,
    refresh_token: parsed.data.refresh_token,
  });

  if (error) {
    return new NextResponse(`Set session failed: ${error.message}`, {
      status: 401,
    });
  }

  return new NextResponse(null, { status: 204 });
}
