import { mkdir } from "node:fs/promises";
import path from "node:path";

import { test as setup, expect, request } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const STORAGE_STATE = "tests/e2e/.auth/user.json";
const TEST_EMAIL = "e2e-tester@example.com";

// Supabase's local stack ships Mailpit at port 54324 (image:
// `public.ecr.aws/supabase/mailpit:v1.22.3`). Mailpit's REST API is at
// `/api/v1`, distinct from the older Inbucket scheme.
const MAILPIT_URL = "http://127.0.0.1:54324";

interface MailpitMessageSummary {
  ID: string;
  Created: string;
  To: { Address: string }[];
}

interface MailpitListResponse {
  messages: MailpitMessageSummary[];
}

interface MailpitMessageDetail {
  ID: string;
  HTML?: string;
  Text?: string;
}

async function ensureUser(): Promise<void> {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required to bootstrap the e2e test user.",
    );
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: list, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) throw listErr;
  const existing = list.users.find((u) => u.email === TEST_EMAIL);
  if (existing) {
    await admin.auth.admin.deleteUser(existing.id);
  }

  const { error: createErr } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    email_confirm: true,
    user_metadata: { display_name: "E2E Tester" },
  });
  if (createErr) throw createErr;
}

async function purgeMailbox(mailbox: string): Promise<void> {
  const api = await request.newContext();
  await api.delete(`${MAILPIT_URL}/api/v1/search`, {
    params: { query: `to:${mailbox}` },
  });
  await api.dispose();
}

async function fetchLatestMagicLink(
  mailbox: string,
  sentAfter: number,
): Promise<string> {
  const api = await request.newContext();
  try {
    for (let attempt = 0; attempt < 20; attempt++) {
      const resp = await api.get(`${MAILPIT_URL}/api/v1/search`, {
        params: { query: `to:${mailbox}`, limit: "10" },
      });
      if (resp.ok()) {
        const payload: MailpitListResponse = await resp.json();
        // Mailpit returns newest first; double-sort defensively.
        const fresh = payload.messages
          .filter((m) => new Date(m.Created).getTime() >= sentAfter - 1000)
          .sort(
            (a, b) =>
              new Date(b.Created).getTime() - new Date(a.Created).getTime(),
          );
        const latest = fresh[0];
        if (latest) {
          const detailResp = await api.get(
            `${MAILPIT_URL}/api/v1/message/${latest.ID}`,
          );
          if (detailResp.ok()) {
            const detail: MailpitMessageDetail = await detailResp.json();
            const body = detail.Text ?? detail.HTML ?? "";
            // Prefer the verify URL with type=magiclink — that's the actual
            // sign-in link. Strip any &amp; encoding from HTML bodies.
            const match = body
              .replace(/&amp;/g, "&")
              .match(/https?:\/\/[^\s)<>"]+\/auth\/v1\/verify\?[^\s)<>"]+/);
            if (match?.[0]) return match[0];
          }
        }
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  } finally {
    await api.dispose();
  }
  throw new Error(
    `No magic-link email arrived for ${mailbox} within 10s of submission`,
  );
}

setup("authenticate test user", async ({ page }) => {
  await ensureUser();
  // Mailpit can hold stale links from prior runs; clear so we don't follow
  // an expired token.
  await purgeMailbox(TEST_EMAIL);
  const sentAt = Date.now();

  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_EMAIL);
  await page.getByRole("button", { name: /отправить ссылку/i }).click();
  await expect(page.getByText(/ссылка отправлена/i)).toBeVisible();

  const magicLink = await fetchLatestMagicLink(TEST_EMAIL, sentAt);
  await page.goto(magicLink);

  // GoTrue verifies the token, our /auth/callback exchanges code -> session,
  // then redirects to the next target (defaults to /). Wait until we're off
  // /login *and* off /auth/* so cookies are committed before we capture state.
  await page.waitForURL(
    (url) =>
      !url.pathname.startsWith("/login") &&
      !url.pathname.startsWith("/auth/"),
    { timeout: 15_000 },
  );
  await expect(page).not.toHaveURL(/\/login/);

  await mkdir(path.dirname(STORAGE_STATE), { recursive: true });
  await page.context().storageState({ path: STORAGE_STATE });
});
