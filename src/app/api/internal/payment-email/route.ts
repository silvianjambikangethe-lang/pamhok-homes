import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { sendPaymentSucceededEmail } from "@/lib/booking-emails";

// Called by the jenga-pgw-callback Supabase Edge Function right after it marks
// a booking Paid, so card and M-Pesa payments send the SAME confirmation email
// (receipt attached, saveable link) as an admin "mark paid", instead of the
// edge function keeping its own older copy of the template. Edge Functions
// can't import this app's email code or render the receipt image, so they call
// here. Authorised with the service-role key, which both sides already hold.
export const maxDuration = 30;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isAuthorized(request: Request): boolean {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return false;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const bookingId = typeof body?.bookingId === "string" ? body.bookingId : "";
  if (!UUID_RE.test(bookingId)) {
    return NextResponse.json({ error: "Invalid booking." }, { status: 400 });
  }

  // True when the booking had already been paid once, i.e. this payment is
  // a stay extension, which gets its own wording.
  const wasAlreadyPaid = body?.wasAlreadyPaid === true;

  await sendPaymentSucceededEmail(createAdminSupabaseClient(), bookingId, wasAlreadyPaid);
  return NextResponse.json({ ok: true });
}
