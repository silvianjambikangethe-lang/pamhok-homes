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
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const [frontFileName, setFrontFileName] = useState<string | null>(null);
  const [backFileName, setBackFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const frontFile = frontInputRef.current?.files?.[0];
    const backFile = backInputRef.current?.files?.[0];
    if (!frontFile || !backFile) {
      setError("Please choose both the front and back of your ID.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", frontFile);
    formData.append("back", backFile);

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
    // Step 1 (not yet submitted): Warm Taupe wash in light mode (per
    // master-color-scheme.md), Deep Forest wash in dark mode, unchanged —
    // the old Sage-in-light wash is gone but dark keeps its own signal.
    <div className="rounded-2xl border border-taupe/30 bg-taupe/15 p-6 shadow-card dark:border-forest-500/40 dark:bg-forest-500/20">
      <h2 className="font-serif text-h3 text-ink">
        {attemptsLeft !== undefined
          ? "Let's try that again"
          : rejected
            ? "Please re-upload your ID"
            : "Step 1 — Verify your identity"}
      </h2>
      <p className="mt-1 text-sm text-ink/80">
        {attemptsLeft !== undefined
          ? `We couldn't verify that automatically. Please upload clearer photos of the front and back of your ID — you have ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} left before this needs a quick manual review from your host.`
          : rejected
            ? "Your previous upload couldn't be verified. Please upload clear photos of the front and back of your national ID or passport."
            : "Upload clear photos of the front and back of your national ID or passport — your host will review it shortly."}
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-taupe/40 bg-surface px-4 py-8 text-center transition-colors hover:border-terracotta-300">
          <UploadSimple size={28} className="text-terracotta-600" />
          <span className="text-sm font-medium text-ink/80">
            {frontFileName ?? "Click to choose the front of your ID (JPG, PNG, or PDF)"}
          </span>
          <input
            ref={frontInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="sr-only"
            onChange={(e) => setFrontFileName(e.target.files?.[0]?.name ?? null)}
          />
        </label>

        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-taupe/40 bg-surface px-4 py-8 text-center transition-colors hover:border-terracotta-300">
          <UploadSimple size={28} className="text-terracotta-600" />
          <span className="text-sm font-medium text-ink/80">
            {backFileName ?? "Click to choose the back of your ID (JPG, PNG, or PDF)"}
          </span>
          <input
            ref={backInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="sr-only"
            onChange={(e) => setBackFileName(e.target.files?.[0]?.name ?? null)}
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
          className="focus-ring w-full rounded-full bg-mocha-500 dark:bg-terracotta-500 px-6 py-3 text-sm font-semibold text-mousse dark:text-white transition-colors hover:bg-mocha-600 dark:hover:bg-terracotta-600 disabled:opacity-60"
        >
          {submitting ? "Uploading…" : "Upload for Verification"}
        </button>
      </form>
    </div>
  );
}
