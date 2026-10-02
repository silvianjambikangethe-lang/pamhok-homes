import { NextResponse } from "next/server";
import { verifyRecognitionCode } from "@/lib/guest-recognition";
import { getClientIp } from "@/lib/rate-limit";
import { EMAIL_RE } from "@/lib/validation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  if (!email || email.length > 254 || !EMAIL_RE.test(email) || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "That code doesn't look right." }, { status: 400 });
  }

  const result = await verifyRecognitionCode(email, code, getClientIp(request));
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    fullName: result.fullName,
    phone: result.phone,
    recognitionToken: result.recognitionToken,
  });
}
