"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadSimple, Warning } from "@phosphor-icons/react";

export default function IdUploadForm({
  token,
  rejected,
  attemptsLeft,
}: {
  token: string;
  rejected: boolean;
  attemptsLeft?: number;
}) {
  const router = useRouter();
  const idInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const [idFileName, setIdFileName] = useState<string | null>(null);
  const [selfieFileName, setSelfieFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const idFile = idInputRef.current?.files?.[0];
    const selfieFile = selfieInputRef.current?.files?.[0];
    if (!idFile || !selfieFile) {
      setError("Please choose both an ID photo and a selfie.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", idFile);
    formData.append("selfie", selfieFile);

    try {
      const res = await fetch(`/api/portal/${token}/upload-id`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Upload failed. Please try again.");
        setSubmitting(false);
        return;
      }

      router.refresh();
    } catch {
      setError("Upload failed. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    // Step 1 (not yet submitted): Sage wash in light mode, Deep Forest
    // wash in dark mode — Sage is too faint to read against a dark
    // background, so the "calm/inactive" signal swaps to Forest instead.
    <div className="rounded-2xl border border-sage-500/30 bg-sage-500/15 p-6 shadow-card dark:border-forest-500/40 dark:bg-forest-500/20">
      <h2 className="font-serif text-h3 text-ink">
        {attemptsLeft !== undefined
          ? "Let's try that again"
          : rejected
            ? "Please re-upload your ID"
            : "Step 1 — Verify your identity"}
      </h2>
      <p className="mt-1 text-sm text-ink/80">
        {attemptsLeft !== undefined
          ? `We couldn't verify that automatically. Please upload a clearer photo of your ID and a selfie — you have ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} left before this needs a quick manual review from your host.`
          : rejected
            ? "Your previous upload couldn't be verified. Please upload a clear photo of your national ID or passport, plus a selfie."
            : "Upload a clear photo of your national ID or passport, plus a quick selfie — we verify most guests automatically within seconds."}
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gold-500/40 bg-surface px-4 py-8 text-center transition-colors hover:border-terracotta-300">
          <UploadSimple size={28} className="text-terracotta-600" />
          <span className="text-sm font-medium text-ink/80">
            {idFileName ?? "Click to choose your ID (JPG, PNG, or PDF)"}
          </span>
          <input
            ref={idInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="sr-only"
            onChange={(e) => setIdFileName(e.target.files?.[0]?.name ?? null)}
          />
        </label>

        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gold-500/40 bg-surface px-4 py-8 text-center transition-colors hover:border-terracotta-300">
          <UploadSimple size={28} className="text-terracotta-600" />
          <span className="text-sm font-medium text-ink/80">
            {selfieFileName ?? "Click to choose a selfie (JPG, PNG, or WebP)"}
          </span>
          <input
            ref={selfieInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => setSelfieFileName(e.target.files?.[0]?.name ?? null)}
          />
        </label>

        {error && (
          <p role="alert" className="flex items-center gap-2 text-sm text-danger">
            <Warning size={16} /> {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="focus-ring w-full rounded-full bg-terracotta-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-terracotta-600 disabled:opacity-60"
        >
          {submitting ? "Verifying…" : "Upload & Verify"}
        </button>
      </form>
    </div>
  );
}
