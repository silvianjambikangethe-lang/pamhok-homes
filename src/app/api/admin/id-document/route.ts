import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type DocType = "id" | "selfie" | "id2" | "selfie2";
const VALID_TYPES: DocType[] = ["id", "selfie", "id2", "selfie2"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bookingId = searchParams.get("bookingId");
  const typeParam = searchParams.get("type");
  const type: DocType = VALID_TYPES.includes(typeParam as DocType) ? (typeParam as DocType) : "id";
  if (!bookingId) {
    return NextResponse.json({ error: "Missing bookingId." }, { status: 400 });
  }

  // Confirm the caller is a real admin via their session + RLS before
  // using the service role to reach into private storage.
  const sessionClient = await createServerSupabaseClient();
  const { data: booking, error } = await sessionClient
    .from("bookings")
    .select("id_document_path, id_selfie_path, id_document_path_2, id_selfie_path_2")
    .eq("id", bookingId)
    .maybeSingle();

  if (error || !booking) {
    return NextResponse.json({ error: "Not authorized or not found." }, { status: 403 });
  }

  const pathByType: Record<DocType, string | null> = {
    id: booking.id_document_path,
    selfie: booking.id_selfie_path,
    id2: booking.id_document_path_2,
    selfie2: booking.id_selfie_path_2,
  };
  const path = pathByType[type];
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
