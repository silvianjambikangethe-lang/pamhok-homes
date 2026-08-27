import { Info, SealCheck } from "@phosphor-icons/react/dist/ssr";

export default function VerificationPassSection({
  isReady,
  idVerified,
  hasPendingExtension,
}: {
  isReady: boolean;
  idVerified: boolean;
  hasPendingExtension: boolean;
}) {
  if (!isReady) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-taupe/25 bg-page p-5 text-sm text-ink/80 shadow-card">
        <Info size={20} className="mt-0.5 shrink-0 text-terracotta-600" />
        <p>
          {hasPendingExtension
            ? "Your extra nights are held for you, and your door code, WiFi, and other stay details stay active below. See the extension section for your payment deadline."
            : idVerified
              ? "Your ID is already verified — complete payment below to unlock your door code and WiFi."
              : "Your verification pass will be available once your ID is confirmed and payment is complete."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-2xl border-2 border-terracotta-500 bg-surface p-5 text-sm text-ink/80 shadow-card">
      <SealCheck size={20} weight="fill" className="mt-0.5 shrink-0 text-success" />
      <p>
        You&apos;re verified! Your guest card will appear once you tap{" "}
        <strong className="text-ink">&quot;I&apos;ve Arrived&quot;</strong> below —
        that&apos;s what you&apos;ll show building security or reception.
      </p>
    </div>
  );
}
