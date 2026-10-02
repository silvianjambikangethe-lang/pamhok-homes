import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Saves the guest's Yes/No on the "remember me" card the moment they pick it,
// so the question stays gone after any reload (for example coming back from a
// laundry payment). It only records the answer; the guest is actually added
// to, or removed from, the remembered list when the stay is checked out (see
// completeCheckout), which also covers a guest who never taps Check Out.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = await request.json().catch(() => null);
  if (typeof body?.choice !== "boolean") {
    return NextResponse.json({ error: "Choose Yes or No." }, { status: 400 });
  }

  const { data, error } = await createAdminSupabaseClient()
    .from("bookings")
    .update({ remember_me_choice: body.choice })
    .eq("access_token", token)
    .is("checked_out_at", null)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Could not save your choice." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
