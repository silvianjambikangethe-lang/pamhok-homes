import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isSmileIdConfigured, runDocumentVerification } from "@/lib/smileid";
import type { SmileIdResult } from "@/lib/supabase/types";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ID_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
// Selfies must be a real photo — Smile ID can't process a PDF as a face image.
const SELFIE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_ATTEMPTS = 3;

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
    .select("id, booking_status, id_verification_status, id_verification_attempts")
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

  // Automated check first; if it can't run or doesn't pass, this falls back
  // to the existing manual-review flow — the admin's Verify/Reject buttons
  // on the ID Verifications page double as the override for that case.
  const canRunAutomatedCheck = isSmileIdConfigured() && idFile.type !== "application/pdf";
  let verificationStatus: "Pending" | "Verified" = "Pending";
  let smileIdResult: SmileIdResult | null = null;

  if (canRunAutomatedCheck) {
    try {
      const [idBuffer, selfieBuffer] = await Promise.all([
        idFile.arrayBuffer().then((b) => Buffer.from(b)),
        selfieFile.arrayBuffer().then((b) => Buffer.from(b)),
      ]);

      smileIdResult = await runDocumentVerification({
        jobId: booking.id,
        userId: booking.id,
        idImage: { buffer: idBuffer, fileName: `id.${idExtension}` },
        selfieImage: { buffer: selfieBuffer, fileName: `selfie.${selfieExtension}` },
        // Pamhok Homes is Nairobi-based, so guests are assumed to present a
        // Kenyan national ID — the guest portal doesn't currently ask for
        // country/ID type since 100% of stays are local so far.
        country: "KE",
        idType: "NATIONAL_ID",
      });

      if (smileIdResult.success) {
        verificationStatus = "Verified";
      }
    } catch (err) {
      smileIdResult = {
        success: false,
        resultCode: null,
        resultText: (err as Error).message || "Automated check failed to run.",
        actions: null,
        checkedAt: new Date().toISOString(),
      };
    }
  }

  const needsManualReview = verificationStatus === "Pending";

  // Only count an attempt when a real automated check actually ran and
  // failed — a PDF upload or an unreachable/unconfigured Smile ID means
  // there was nothing for the guest to meaningfully retry against, so
  // that case skips straight to manual review instead of burning one of
  // their 3 tries.
  let attempts = booking.id_verification_attempts;
  let escalateToAdmin = false;

  if (needsManualReview) {
    if (canRunAutomatedCheck) {
      attempts += 1;
      escalateToAdmin = attempts >= MAX_ATTEMPTS;
    } else {
      escalateToAdmin = true;
    }
  }

  const { error: updateError } = await supabase
    .from("bookings")
    .update({
      id_document_path: idPath,
      id_selfie_path: selfiePath,
      id_verification_status: verificationStatus,
      id_verification_method: needsManualReview ? null : "automatic",
      id_verification_attempts: attempts,
      smile_id_result: smileIdResult,
      // Held distinctly from 'Confirmed' while it awaits manual review, so
      // the admin dashboard can tell paid-and-confirmed bookings apart from
      // ones still stuck in limbo. Already in availability_view alongside
      // 'Confirmed', so this never unlocks the calendar slot.
      ...(escalateToAdmin ? { booking_status: "Pending Verification" } : {}),
    })
    .eq("id", booking.id);

  if (updateError) {
    return NextResponse.json({ error: "Could not save upload." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    autoVerified: verificationStatus === "Verified",
    attemptsRemaining: needsManualReview && !escalateToAdmin ? MAX_ATTEMPTS - attempts : 0,
  });
}
