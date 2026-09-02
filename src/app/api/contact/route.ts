import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sendEmail, contactMessageEmail } from "@/lib/email";
import { SITE } from "@/lib/site";

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

  const { subject, html } = contactMessageEmail({
    name: body.name.trim(),
    email: body.email.trim(),
    message: body.message.trim(),
  });

  // Best-effort — sendEmail() already swallows its own errors, and a
  // delivery failure shouldn't make the visitor think their message
  // wasn't received when the validation above already succeeded.
  // replyTo is the visitor's own address (not the sendEmail() default of
  // SITE.contactEmail) so replying from hello@ reaches them directly,
  // not back to hello@ itself.
  await sendEmail({
    to: SITE.contactEmail,
    subject,
    html,
    replyTo: body.email.trim(),
  });

  return NextResponse.json({ ok: true });
}
