import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (
    !body ||
    typeof body.name !== "string" ||
    typeof body.email !== "string" ||
    typeof body.message !== "string" ||
    !body.name.trim() ||
    !body.email.trim() ||
    !body.message.trim()
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
