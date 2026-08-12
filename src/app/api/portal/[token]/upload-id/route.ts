import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ID_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
// Selfies must be a real photo — a face image is required for manual review.
const SELFIE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function validateFile(file: unknown, allowedTypes: string[]): file is File {
  return (
    file instanceof File &&
    allowedTypes.includes(file.type) &&
    file.size <= MAX_SIZE
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const supabase = createAdminSupabaseClient();

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id")
    .eq("access_token", token)
    .maybeSingle();

  if (bookingError || !booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  const formData = await request.formData().catch(() => null);
  const idFile = formData?.get("file");
  const selfieFile = formData?.get("selfie");

  if (!validateFile(idFile, ID_TYPES)) {
    return NextResponse.json(
      { error: "Please upload a clear JPG, PNG, WebP, or PDF of your ID (under 10MB)." },
      { status: 400 },
    );
  }
  if (!validateFile(selfieFile, SELFIE_TYPES)) {
    return NextResponse.json(
      { error: "Please upload a clear JPG, PNG, or WebP selfie (under 10MB)." },
      { status: 400 },
    );
  }

  const idExtension = idFile.name.split(".").pop() ?? "bin";
  const selfieExtension = selfieFile.name.split(".").pop() ?? "bin";
  const stamp = Date.now();
  const idPath = `${booking.id}/id-${stamp}.${idExtension}`;
  const selfiePath = `${booking.id}/selfie-${stamp}.${selfieExtension}`;

  const [idUpload, selfieUpload] = await Promise.all([
    supabase.storage.from("id-documents").upload(idPath, idFile, {
      contentType: idFile.type,
      upsert: false,
    }),
    supabase.storage.from("id-documents").upload(selfiePath, selfieFile, {
      contentType: selfieFile.type,
      upsert: false,
    }),
  ]);

  if (idUpload.error || selfieUpload.error) {
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }

  // No automated verification provider is configured — every upload goes
  // straight to manual review. id_verification_result/attempts/method
  // ('automatic') are left as a ready hook for a future provider to fill
  // in the same way Smile ID used to.
  const { error: updateError } = await supabase
    .from("bookings")
    .update({
      id_document_path: idPath,
      id_selfie_path: selfiePath,
      id_verification_status: "Pending",
      id_verification_method: null,
      // Held distinctly from 'Confirmed' while it awaits manual review, so
      // the admin dashboard can tell paid-and-confirmed bookings apart from
      // ones still stuck in limbo. Already in availability_view alongside
      // 'Confirmed', so this never unlocks the calendar slot.
      booking_status: "Pending Verification",
    })
    .eq("id", booking.id);

  if (updateError) {
    return NextResponse.json({ error: "Could not save upload." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
