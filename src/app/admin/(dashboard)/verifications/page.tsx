import { createServerSupabaseClient } from "@/lib/supabase/server";
import VerificationCard, { type VerificationRow } from "@/components/admin/VerificationCard";

export default async function AdminVerificationsPage() {
  const supabase = await createServerSupabaseClient();

  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      "id, check_in, check_out, id_document_path, id_selfie_path, id_verification_result, id_verification_attempts, guest:guests(full_name), room:rooms(name)",
    )
    .eq("id_verification_status", "Pending")
    // No automated provider is configured, so every upload lands straight
    // here for manual review.
    .eq("booking_status", "Pending Verification")
    .order("created_at", { ascending: true });

  const rows: VerificationRow[] = (bookings ?? []).map((b) => ({
    id: b.id,
    check_in: b.check_in,
    check_out: b.check_out,
    guestName: (b as unknown as { guest?: { full_name?: string } }).guest?.full_name ?? null,
    roomName: (b as unknown as { room?: { name?: string } }).room?.name ?? null,
    hasDocument: Boolean(b.id_document_path),
    hasSelfie: Boolean(b.id_selfie_path),
    verificationResult: b.id_verification_result,
    attempts: b.id_verification_attempts,
  }));

  return (
    <div>
      <h1 className="font-serif text-h2 text-ink">ID Verifications</h1>
      <p className="mt-1 text-sm text-ink/80">
        No automated verification provider is configured, so every guest ID
        upload lands here for you to review and approve or reject below.
      </p>

      <div className="mt-6 space-y-4">
        {rows.length === 0 && (
          <p className="rounded-2xl border border-taupe/20 bg-surface p-6 text-sm text-ink/65 shadow-card">
            Nothing pending review right now.
          </p>
        )}
        {rows.map((row) => (
          <VerificationCard key={row.id} row={row} />
        ))}
      </div>
    </div>
  );
}
