"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Warning, Fingerprint } from "@phosphor-icons/react";
import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";
import { SITE } from "@/lib/site";

// Biometrics is tried FIRST, automatically, before the password form
// ever appears — password is only a fallback for when biometrics isn't
// registered, isn't supported on this device, fails, or is cancelled.
// It is never removed as an option: this state machine always ends up
// showing the password form if the passkey attempt doesn't succeed.
type PasskeyState = "checking" | "prompting" | "unavailable" | "failed";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const notAuthorized = searchParams.get("error") === "not-authorized";

  const [passkeyState, setPasskeyState] = useState<PasskeyState>("checking");
  const [passkeyOptionsAvailable, setPasskeyOptionsAvailable] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  async function attemptPasskeyLogin() {
    setError(null);
    if (!browserSupportsWebAuthn()) {
      setPasskeyState("unavailable");
      return;
    }

    let optionsRes: Response;
    try {
      optionsRes = await fetch("/api/admin/passkey/login/options", { method: "POST" });
    } catch {
      setPasskeyState("unavailable");
      return;
    }
    const optionsData = await optionsRes.json().catch(() => null);
    if (!optionsData?.available) {
      setPasskeyState("unavailable");
      return;
    }

    setPasskeyOptionsAvailable(true);
    setPasskeyState("prompting");

    let assertion;
    try {
      assertion = await startAuthentication({ optionsJSON: optionsData.options });
    } catch {
      // User cancelled, no matching credential on this device, timeout,
      // etc. — not an error worth alarming over, just fall back.
      setPasskeyState("failed");
      return;
    }

    const verifyRes = await fetch("/api/admin/passkey/login/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response: assertion }),
    });

    if (!verifyRes.ok) {
      setPasskeyState("failed");
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  useEffect(() => {
    // Auto-attempt exactly once on mount — a retry is a deliberate user
    // action via the button below, not something to loop on its own.
    // The lint rule this suppresses is meant to catch effects that
    // synchronously derive state from props/other state (a footgun);
    // this is the standard "kick off an async fetch on mount" shape,
    // which the rule's own author lists as an accepted exception.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    attemptPasskeyLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setLocked(false);

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Incorrect email or password.");
      setLocked(Boolean(data?.locked));
      setSubmitting(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  const showPasswordForm = passkeyState === "unavailable" || passkeyState === "failed";

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-taupe/20 bg-surface p-8 shadow-warm">
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SITE.logoIconUrl} alt={SITE.name} className="h-16 w-16 rounded-xl object-cover" />
        </div>
        <h1 className="mt-4 text-center font-serif text-2xl font-semibold text-ink">
          Owner Login
        </h1>
        <p className="mt-1 text-center text-sm text-ink/80">
          {SITE.name} admin dashboard
        </p>

        {notAuthorized && (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            <Warning size={16} />
            That account isn&apos;t set up as an admin.
          </p>
        )}

        {(passkeyState === "checking" || passkeyState === "prompting") && (
          <div className="mt-6 flex flex-col items-center gap-3 py-6 text-center">
            <Fingerprint size={40} className="text-terracotta-500" />
            <p className="text-sm text-ink/70">
              {passkeyState === "checking"
                ? "Checking for biometric login…"
                : "Follow your device's prompt to sign in…"}
            </p>
          </div>
        )}

        {showPasswordForm && (
          <>
            {passkeyState === "failed" && (
              <p className="mt-4 text-center text-sm text-ink/60">
                Biometric login didn&apos;t complete — use your password instead.
              </p>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="email" className="text-sm font-medium text-ink/80">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3.5 py-2.5 text-sm text-ink"
                />
              </div>
              <div>
                <label htmlFor="password" className="text-sm font-medium text-ink/80">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  maxLength={128}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                {submitting ? "Signing in…" : "Sign In"}
              </button>
            </form>

            {passkeyOptionsAvailable && (
              <button
                type="button"
                onClick={attemptPasskeyLogin}
                className="focus-ring mt-4 flex w-full items-center justify-center gap-2 text-sm font-medium text-ink/60 hover:text-ink/80"
              >
                <Fingerprint size={16} /> Try biometric login again
              </button>
            )}

            <p className="mt-5 text-center text-sm">
              <a
                href="/admin/recover"
                className={`focus-ring rounded font-medium ${
                  locked
                    ? "text-danger underline"
                    : "text-ink/60 hover:text-ink/80"
                }`}
              >
                {locked ? "Locked out? Reset your password via email" : "Forgot password?"}
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
