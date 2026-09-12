import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Basic fixed-window rate limiting for public forms, backed by the
// rate_limits table (serverless functions have no persistent in-process
// memory to count against). Same spirit as the admin login lockout in
// /api/admin/login, generalized to any route.
export async function checkRateLimit(
  routeKey: string,
  identifier: string,
  { maxAttempts, windowMinutes }: { maxAttempts: number; windowMinutes: number },
): Promise<{ allowed: true } | { allowed: false; retryAfterMinutes: number }> {
  const supabase = createAdminSupabaseClient();
  const key = `${routeKey}:${identifier}`;
  const now = new Date();

  const { data: existing } = await supabase
    .from("rate_limits")
    .select("attempt_count, window_started_at")
    .eq("key", key)
    .maybeSingle();

  const windowStarted = existing ? new Date(existing.window_started_at) : null;
  const windowExpired =
    !windowStarted || now.getTime() - windowStarted.getTime() > windowMinutes * 60_000;

  if (windowExpired) {
    await supabase
      .from("rate_limits")
      .upsert({ key, attempt_count: 1, window_started_at: now.toISOString() });
    return { allowed: true };
  }

  if ((existing?.attempt_count ?? 0) >= maxAttempts) {
    const retryAfterMinutes = Math.max(
      1,
      Math.ceil(windowMinutes - (now.getTime() - windowStarted.getTime()) / 60_000),
    );
    return { allowed: false, retryAfterMinutes };
  }

  await supabase
    .from("rate_limits")
    .update({ attempt_count: (existing?.attempt_count ?? 0) + 1 })
    .eq("key", key);
  return { allowed: true };
}

// Vercel sets x-forwarded-for on every request; falls back to a shared
// bucket for the rare case it's missing rather than failing open.
//
// Takes the LAST entry, not the first: x-forwarded-for is built by each
// hop APPENDING the IP it received the request from ("client, proxy1,
// ..., proxyN"), so the last entry is always the IP of whoever connected
// directly to us (Vercel's own edge) — trustworthy, since it's Vercel's
// own network observation, not something in the request itself. The
// first entry is whatever the client claimed as *its own* upstream chain
// and is fully attacker-controlled: a request can arrive with its own
// fake "x-forwarded-for: 1.2.3.4" header, and taking the first entry
// would rate-limit "1.2.3.4" forever while the real requester rotates
// that value on every request, bypassing every IP-keyed limiter in this
// file entirely (2026-09-12 fix — found during a security review, not
// confirmed exploited).
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const hops = forwardedFor.split(",").map((h) => h.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
