import { NextResponse, type NextRequest } from "next/server";

import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Magic-link / OAuth callback. Two flows handled:
 *
 * 1. PKCE (`?code=...`) — the normal browser sign-in. We exchange the code
 *    for a session server-side; cookies are written by the Supabase server
 *    client and the user is forwarded to `next` (default `/`).
 *
 * 2. Implicit (`#access_token=...&refresh_token=...`) — emitted by the
 *    Supabase Admin API `generate_link` endpoint. The server never sees the
 *    hash (browsers don't send it), so we render a tiny HTML page that
 *    parses it client-side and POSTs the tokens to `/auth/callback/set`,
 *    which writes the session cookies. The whole round-trip stays on
 *    https://roleroadmap.vercel.app — no extra origins, no third-party JS.
 *
 * If the URL has neither, we bounce back to /login with an error.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  // safeRedirectPath отклоняет protocol-relative (//evil.com) и /\evil.
  const next = safeRedirectPath(url.searchParams.get("next"));

  if (code) {
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

  // No `?code` — render a small HTML page that extracts tokens from the URL
  // hash on the client and posts them to /auth/callback/set. We escape
  // `next` against XSS via JSON-stringify (which already quotes it) so it
  // can be embedded inside the script verbatim.
  const safeNext = JSON.stringify(next);
  const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Завершаем вход…</title>
  <style>
    body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#fbfaf7;color:#1a1816}
    .card{max-width:420px;padding:24px;border:1px solid #e5e1d8;border-radius:12px;background:#fff;text-align:center}
    .err{color:#b45309;margin-top:12px;font-size:13px}
  </style>
</head>
<body>
  <div class="card">
    <p>Завершаем вход…</p>
    <p id="msg" class="err" hidden></p>
  </div>
  <script>
  (async () => {
    function showError(msg) {
      const el = document.getElementById('msg');
      el.textContent = msg;
      el.hidden = false;
    }
    const hash = (window.location.hash || '').replace(/^#/, '');
    if (!hash) {
      showError('Нет авторизационных данных в URL. Попробуйте получить новую ссылку.');
      return;
    }
    const params = new URLSearchParams(hash);
    if (params.get('error')) {
      const code = params.get('error_code') || params.get('error') || 'unknown';
      const desc = params.get('error_description') || '';
      showError('Ошибка авторизации: ' + code + (desc ? ' — ' + desc : ''));
      return;
    }
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (!accessToken || !refreshToken) {
      showError('В URL не оказалось токенов сессии.');
      return;
    }
    try {
      const r = await fetch('/auth/callback/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken })
      });
      if (!r.ok) {
        const t = await r.text();
        showError('Сервер отверг сессию: ' + (t || r.status));
        return;
      }
      window.location.replace(${safeNext});
    } catch (e) {
      showError('Сетевая ошибка: ' + (e && e.message || e));
    }
  })();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      // Минимальная CSP для страницы-моста: только inline-скрипт (нужен для
      // чтения location.hash) + fetch к самому себе (POST на /auth/callback/set).
      "Content-Security-Policy":
        "default-src 'none'; script-src 'unsafe-inline'; connect-src 'self'",
    },
  });
}
