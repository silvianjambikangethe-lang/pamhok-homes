import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { completeCheckout } from "@/lib/checkout";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const result = await completeCheckout(createAdminSupabaseClient(), { accessToken: token });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    result.alreadyCheckedOut ? { ok: true, alreadyCheckedOut: true } : { ok: true },
  );
}
