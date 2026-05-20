import "server-only";

import { PostHog } from "posthog-node";

/**
 * Lazily-constructed PostHog client. We initialize once per Node process and
 * reuse — PostHog batches events internally and flushes async. A no-op
 * wrapper kicks in when the key is empty or the placeholder, so local dev /
 * tests don't network-call PostHog.
 */

const STUB_PREFIX = "phc_stub";

let cachedClient: PostHog | null | undefined;

function getClient(): PostHog | null {
  if (cachedClient !== undefined) return cachedClient;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";
  if (!key || key.startsWith(STUB_PREFIX)) {
    cachedClient = null;
    return null;
  }
  cachedClient = new PostHog(key, { host, flushAt: 1, flushInterval: 1000 });
  return cachedClient;
}

/**
 * Fire-and-forget event to PostHog. Never throws — analytics outages must
 * not break user actions.
 */
export function captureEvent(
  userId: string,
  event: string,
  properties: Record<string, unknown> = {},
): void {
  const client = getClient();
  if (!client) return;
  try {
    client.capture({
      distinctId: userId,
      event,
      properties,
    });
  } catch {
    /* swallow */
  }
}

/** Best-effort flush — call from long-lived contexts before they shut down. */
export async function flushAnalytics(): Promise<void> {
  const client = getClient();
  if (!client) return;
  try {
    await client.shutdown();
  } catch {
    /* swallow */
  } finally {
    cachedClient = null;
  }
}
