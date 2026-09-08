import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { analyzeIdDocument } from "@/lib/dojah";
import type { IdVerificationResult } from "@/lib/supabase/types";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ID_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_ATTEMPTS = 2;

function validateFile(file: unknown, allowedTypes: string[]): file is File {
  return (
    file instanceof File &&
    allowedTypes.includes(file.type) &&
    file.size <= MAX_SIZE
  );
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return buffer.toString("base64");
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

  // Already escalated to manual review — the portal UI doesn't show the
  // upload form in this state, so this only guards against a stale/duplicate
  // submit (e.g. a second tab).
  if (booking.booking_status === "Pending Verification") {
    return NextResponse.json(
      { error: "This booking is already awaiting manual review." },
      { status: 409 },
    );
  }

  const formData = await request.formData().catch(() => null);
  const frontFile = formData?.get("file");
  const backFile = formData?.get("back");

  if (!validateFile(frontFile, ID_TYPES)) {
    return NextResponse.json(
      { error: "Please upload a clear JPG, PNG, WebP, or PDF of the front of your ID (under 10MB)." },
      { status: 400 },
    );
  }
  if (!validateFile(backFile, ID_TYPES)) {
    return NextResponse.json(
      { error: "Please upload a clear JPG, PNG, WebP, or PDF of the back of your ID (under 10MB)." },
      { status: 400 },
    );
  }

  // A fresh cycle starts at 'Not Submitted' (first-ever upload) or
  // 'Rejected' (admin previously made a final manual call, guest is now
  // uploading a new document for a brand-new review) — either way this is
  // attempt 1, and any leftover attempt-2 evidence from an earlier cycle is
  // stale and gets cleared below. Otherwise ('Pending') this is a genuine
  // retry within the same cycle, continuing the attempt count.
  const isFreshCycle = booking.id_verification_status !== "Pending";
  const attemptNumber = isFreshCycle ? 1 : booking.id_verification_attempts + 1;
  const attemptSlot = attemptNumber >= 2 ? 2 : 1;

  const frontExtension = frontFile.name.split(".").pop() ?? "bin";
  const backExtension = backFile.name.split(".").pop() ?? "bin";
  const stamp = Date.now();
  const slotSuffix = attemptSlot === 2 ? "-2" : "";
  const frontPath = `${booking.id}/id${slotSuffix}-${stamp}.${frontExtension}`;
  const backPath = `${booking.id}/id-back${slotSuffix}-${stamp}.${backExtension}`;

  const [frontUpload, backUpload] = await Promise.all([
    supabase.storage.from("id-documents").upload(frontPath, frontFile, {
      contentType: frontFile.type,
      upsert: false,
    }),
    supabase.storage.from("id-documents").upload(backPath, backFile, {
      contentType: backFile.type,
      upsert: false,
    }),
  ]);

  if (frontUpload.error || backUpload.error) {
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }

  // Dojah's document analysis endpoint only takes images — a PDF ID can't
  // be analyzed automatically, so it goes straight to manual review like a
  // provider error would (see below), without spending an attempt.
  const canAutoAnalyze = frontFile.type !== "application/pdf" && backFile.type !== "application/pdf";

  const outcome = canAutoAnalyze
    ? await analyzeIdDocument(await fileToBase64(frontFile), await fileToBase64(backFile))
    : { ok: false as const, error: "Uploaded ID is a PDF; automated analysis only supports images." };

  const pathFields =
    attemptSlot === 2
      ? { id_document_path_2: frontPath, id_document_back_path_2: backPath }
      : { id_document_path: frontPath, id_document_back_path: backPath };

  const clearedStaleAttempt2 =
    isFreshCycle
      ? { id_document_path_2: null, id_document_back_path_2: null, id_verification_result_2: null }
      : {};

  if (!outcome.ok) {
    // Provider-side/config problem (unfunded sandbox wallet, bad
    // credentials, network error, unreadable response) — never the
    // guest's fault, so don't spend one of their two attempts. Fall
    // straight to manual review, same as when no provider is configured
    // at all, but keep the error on record for the admin/owner.
    console.error("Dojah document analysis unavailable:", outcome.error);
    const providerErrorResult: IdVerificationResult = {
      success: false,
      resultCode: "provider_error",
      resultText: outcome.error,
      actions: null,
      checkedAt: new Date().toISOString(),
    };
    const resultField =
      attemptSlot === 2 ? { id_verification_result_2: providerErrorResult } : { id_verification_result: providerErrorResult };

    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        ...pathFields,
        ...resultField,
        ...clearedStaleAttempt2,
        id_verification_status: "Pending",
        id_verification_method: null,
        booking_status: "Pending Verification",
      })
      .eq("id", booking.id);

    if (updateError) {
      return NextResponse.json({ error: "Could not save upload." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const resultField =
    attemptSlot === 2 ? { id_verification_result_2: outcome.result } : { id_verification_result: outcome.result };

  if (outcome.passed) {
    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        ...pathFields,
        ...resultField,
        ...clearedStaleAttempt2,
        id_verification_status: "Verified",
        id_verification_method: "automatic",
        id_verification_attempts: attemptNumber,
      })
      .eq("id", booking.id);

    if (updateError) {
      return NextResponse.json({ error: "Could not save upload." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // Automated check genuinely failed. Escalate once both attempts are used.
  const escalate = attemptNumber >= MAX_ATTEMPTS;
  const { error: updateError } = await supabase
    .from("bookings")
    .update({
      ...pathFields,
      ...resultField,
      ...clearedStaleAttempt2,
      id_verification_status: "Pending",
      id_verification_method: null,
      id_verification_attempts: attemptNumber,
      ...(escalate ? { booking_status: "Pending Verification" } : {}),
    })
    .eq("id", booking.id);

  if (updateError) {
    return NextResponse.json({ error: "Could not save upload." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
