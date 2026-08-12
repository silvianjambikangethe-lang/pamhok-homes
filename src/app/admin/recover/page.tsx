"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle, Warning } from "@phosphor-icons/react";
import { SITE } from "@/lib/site";

function AdminRecoverForm() {
  const searchParams = useSearchParams();
  const expired = searchParams.get("error") === "invalid-or-expired";

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/admin/recover/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Something went wrong.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setSent(true);
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-taupe/20 bg-surface p-8 shadow-warm">
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SITE.logoIconUrl} alt={SITE.name} className="h-16 w-16 rounded-xl object-cover" />
        </div>
        <h1 className="mt-4 text-center font-serif text-2xl font-semibold text-ink">
          Reset Admin Password
        </h1>
        <p className="mt-1 text-center text-sm text-ink/80">
          We&apos;ll email a reset link to the registered admin address.
        </p>

        {expired && !sent && (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            <Warning size={16} />
            That reset link is invalid or has expired. Request a new one below.
          </p>
        )}

        {sent ? (
          <p className="mt-6 flex items-start gap-2 rounded-lg bg-success/10 px-3 py-2.5 text-sm text-success">
            <CheckCircle size={18} weight="fill" className="mt-0.5 shrink-0" />
            If that email is registered as an admin, a reset link has been sent. Check the inbox
            and click the link to set a new password.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="text-sm font-medium text-ink/80">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3.5 py-2.5 text-sm text-ink"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="focus-ring w-full rounded-full bg-mocha-500 dark:bg-terracotta-500 px-6 py-3 text-sm font-semibold text-mousse dark:text-white transition-colors hover:bg-mocha-600 dark:hover:bg-terracotta-600 disabled:opacity-60"
            >
              {submitting ? "Sending…" : "Send Reset Link"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-ink/70">
          <a href="/admin/login" className="focus-ring rounded font-medium text-mocha-500 dark:text-terracotta-500">
            Back to login
          </a>
        </p>
      </div>
    </div>
  );
}

export default function AdminRecoverPage() {
  return (
    <Suspense fallback={null}>
      <AdminRecoverForm />
    </Suspense>
  );
}
