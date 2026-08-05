import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bookingId = searchParams.get("bookingId");
  const type = searchParams.get("type") === "selfie" ? "selfie" : "id";
  if (!bookingId) {
    return NextResponse.json({ error: "Missing bookingId." }, { status: 400 });
  }

  // Confirm the caller is a real admin via their session + RLS before
  // using the service role to reach into private storage.
  const sessionClient = await createServerSupabaseClient();
  const { data: booking, error } = await sessionClient
    .from("bookings")
    .select("id_document_path, id_selfie_path")
    .eq("id", bookingId)
    .maybeSingle();

  if (error || !booking) {
    return NextResponse.json({ error: "Not authorized or not found." }, { status: 403 });
  }

  const path = type === "selfie" ? booking.id_selfie_path : booking.id_document_path;
  if (!path) {
    return NextResponse.json({ error: "No document uploaded." }, { status: 404 });
  }

  const adminClient = createAdminSupabaseClient();
  const { data: signedUrl, error: signError } = await adminClient.storage
    .from("id-documents")
    .createSignedUrl(path, 60);

  if (signError || !signedUrl) {
    return NextResponse.json({ error: "Could not generate link." }, { status: 500 });
  }

  return NextResponse.json({ url: signedUrl.signedUrl });
}
