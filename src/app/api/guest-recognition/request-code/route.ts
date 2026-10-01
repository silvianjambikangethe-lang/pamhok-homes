import { NextResponse } from "next/server";
import { requestRecognitionCode } from "@/lib/guest-recognition";
import { getClientIp } from "@/lib/rate-limit";
import { EMAIL_RE } from "@/lib/validation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const result = await requestRecognitionCode(email, getClientIp(request));
  if (!result.allowed) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${result.retryAfterMinutes} minute${result.retryAfterMinutes === 1 ? "" : "s"}.` },
      { status: 429 },
    );
  }

  // Deliberately generic — whether or not this email is on file, the
  // response looks the same so it can't be used to discover who is.
  return NextResponse.json({ ok: true });
}
