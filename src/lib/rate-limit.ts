// Rate limiter for public API endpoints.
// Uses an in-memory sliding-window counter. Resets on cold-start / redeploy,
// which is acceptable for a Vercel serverless deployment — the goal is to
// deter casual abuse, not to survive distributed attacks.

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

const WINDOW_MS = 60_000; // 1 minute
const CLEANUP_INTERVAL = 5 * 60_000; // purge stale entries every 5 min

let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

/**
 * Returns `true` if the request should be allowed, `false` if rate-limited.
 *
 * @param key   Unique identifier (usually IP or IP + route).
 * @param limit Max requests per window.
 */
export function rateLimit(key: string, limit: number): { allowed: boolean; remaining: number } {
  cleanup();
  const now = Date.now();
  let entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    store.set(key, entry);
  }

  entry.count++;
  const allowed = entry.count <= limit;
  const remaining = Math.max(0, limit - entry.count);
  return { allowed, remaining };
}
