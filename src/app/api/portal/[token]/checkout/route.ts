import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { completeCheckout } from "@/lib/checkout";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = await request.json().catch(() => null);
  const rememberMe = typeof body?.rememberMe === "boolean" ? body.rememberMe : undefined;

  const result = await completeCheckout(createAdminSupabaseClient(), { accessToken: token }, rememberMe);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    result.alreadyCheckedOut ? { ok: true, alreadyCheckedOut: true } : { ok: true },
  );
}
