import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit("contact", getClientIp(request), {
    maxAttempts: 5,
    windowMinutes: 10,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Too many messages sent. Please try again in ${rateLimit.retryAfterMinutes} minute${rateLimit.retryAfterMinutes === 1 ? "" : "s"}.` },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);

  if (
    !body ||
    typeof body.name !== "string" ||
    typeof body.email !== "string" ||
    typeof body.message !== "string" ||
    !body.name.trim() ||
    body.name.trim().length > 200 ||
    !EMAIL_RE.test(body.email.trim()) ||
    !body.message.trim() ||
    body.message.trim().length > 5000
  ) {
    return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
  }

  // TODO(owner): wire this up to an email provider (e.g. Resend) once
  // ready. For now it just confirms receipt to the guest.
  console.log("[contact] message received:", {
    name: body.name,
    email: body.email,
  });

  return NextResponse.json({ ok: true });
}
