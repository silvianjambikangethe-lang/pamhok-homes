import { CheckCircle } from "@phosphor-icons/react/dist/ssr";

// Shown exactly once, on the portal page load right after a stay-extension
// payment resolves (see getBookingByToken's read-and-clear of
// extension_confirmed_at) — deliberately its own message rather than
// reusing CheckInConfirmationMessage, which is specifically the first
// check-in "you're all set" card and reads oddly for a guest already
// mid-stay topping up extra nights.
export default function ExtensionConfirmedMessage() {
  return (
    <div className="rounded-2xl border border-forest-500/30 bg-forest-500/10 p-6 shadow-card">
      <div className="flex items-center gap-2">
        <CheckCircle size={22} weight="fill" className="text-success" />
        <h2 className="font-serif text-h3 text-ink">Extension confirmed</h2>
      </div>
      <p className="mt-2 text-sm text-ink/80">
        Your extension payment has been received. Please enjoy your stay.
      </p>
    </div>
  );
}
