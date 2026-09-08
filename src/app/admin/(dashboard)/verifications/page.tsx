import { createServerSupabaseClient } from "@/lib/supabase/server";
import VerificationCard, { type VerificationRow } from "@/components/admin/VerificationCard";

export default async function AdminVerificationsPage() {
  const supabase = await createServerSupabaseClient();

  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      "id, check_in, check_out, id_document_path, id_document_back_path, id_document_path_2, id_document_back_path_2, id_verification_result, id_verification_result_2, guest:guests(full_name), room:rooms(name)",
    )
    .eq("id_verification_status", "Pending")
    // Only bookings that exhausted both automated Dojah attempts (or hit a
    // provider error) land here — a booking still mid-retry stays off this
    // list until it either passes or is escalated.
    .eq("booking_status", "Pending Verification")
    .order("created_at", { ascending: true });

  const rows: VerificationRow[] = (bookings ?? []).map((b) => ({
    id: b.id,
    check_in: b.check_in,
    check_out: b.check_out,
    guestName: (b as unknown as { guest?: { full_name?: string } }).guest?.full_name ?? null,
    roomName: (b as unknown as { room?: { name?: string } }).room?.name ?? null,
    hasDocument: Boolean(b.id_document_path),
    hasDocumentBack: Boolean(b.id_document_back_path),
    hasDocument2: Boolean(b.id_document_path_2),
    hasDocumentBack2: Boolean(b.id_document_back_path_2),
    verificationResult: b.id_verification_result,
    verificationResult2: b.id_verification_result_2,
  }));

  return (
    <div>
      <h1 className="font-serif text-h2 text-ink">ID Verifications</h1>
      <p className="mt-1 text-sm text-ink/80">
        Guests get two automated Dojah checks before landing here — these are
        the ones that need your call.
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
