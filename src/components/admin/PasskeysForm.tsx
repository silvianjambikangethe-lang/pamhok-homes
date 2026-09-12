"use client";

import { useState } from "react";
import { CheckCircle, Fingerprint, Trash, Warning } from "@phosphor-icons/react";
import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";

type Passkey = {
  id: string;
  device_name: string | null;
  created_at: string;
  last_used_at: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// Registers a new passkey for THIS device/browser — the counterpart to
// /admin/login's auto-attempt. No password re-verification here: being
// logged in as an admin at all is already the gate, same reasoning as
// StaffCredentialsForm.
export default function PasskeysForm({ initial }: { initial: Passkey[] }) {
  const [passkeys, setPasskeys] = useState(initial);
  const [deviceName, setDeviceName] = useState("");
  const [registering, setRegistering] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const supported = typeof window !== "undefined" && browserSupportsWebAuthn();

  async function handleRegister() {
    setError(null);
    setSaved(false);
    setRegistering(true);

    try {
      const optionsRes = await fetch("/api/admin/passkey/register/options", { method: "POST" });
      if (!optionsRes.ok) {
        const data = await optionsRes.json().catch(() => null);
        throw new Error(data?.error ?? "Could not start passkey registration.");
      }
      const options = await optionsRes.json();

      const attestation = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch("/api/admin/passkey/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: attestation, deviceName: deviceName.trim() || null }),
      });

      if (!verifyRes.ok) {
        const data = await verifyRes.json().catch(() => null);
        throw new Error(data?.error ?? "Could not save passkey.");
      }

      const listRes = await fetch("/api/admin/passkeys");
      const listData = await listRes.json().catch(() => null);
      if (listData?.passkeys) setPasskeys(listData.passkeys);

      setDeviceName("");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register passkey.");
    } finally {
      setRegistering(false);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/admin/passkeys/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (res.ok) {
      setPasskeys((prev) => prev.filter((p) => p.id !== id));
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not remove passkey.");
    }
  }

  return (
    <div className="rounded-2xl border border-taupe/20 bg-surface p-6 shadow-warm sm:p-8">
      <h2 className="font-serif text-lg font-semibold text-ink">Passkeys</h2>
      <p className="mt-1 text-sm text-ink/70">
        Sign in to /admin with Face ID, Touch ID, or Windows Hello instead of typing your password —
        tried automatically first, with your password always available as a fallback. Register one
        per device you log in from.
      </p>

      {!supported && (
        <p className="mt-4 flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          <Warning size={16} /> This browser doesn&apos;t support passkeys.
        </p>
      )}

      {passkeys.length > 0 && (
        <ul className="mt-5 space-y-2">
          {passkeys.map((pk) => (
            <li
              key={pk.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-taupe/20 bg-page px-4 py-3"
            >
              <div className="flex items-center gap-2.5">
                <Fingerprint size={18} className="shrink-0 text-terracotta-600" />
                <div>
                  <p className="text-sm font-medium text-ink">
                    {pk.device_name || "Unnamed device"}
                  </p>
                  <p className="text-xs text-ink/55">
                    Added {formatDate(pk.created_at)} · Last used {formatDate(pk.last_used_at)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(pk.id)}
                disabled={busyId === pk.id}
                aria-label="Remove passkey"
                className="focus-ring shrink-0 rounded-full p-2 text-danger hover:bg-danger/10 disabled:opacity-30"
              >
                <Trash size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {supported && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            placeholder="e.g. My laptop (optional)"
            maxLength={100}
            className="focus-ring min-w-0 flex-1 rounded-lg border border-taupe/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
          <button
            type="button"
            onClick={handleRegister}
            disabled={registering}
            className="focus-ring flex items-center gap-1.5 rounded-full bg-mocha-500 dark:bg-terracotta-500 px-5 py-2.5 text-sm font-semibold text-mousse dark:text-white hover:bg-mocha-600 dark:hover:bg-terracotta-600 disabled:opacity-60"
          >
            <Fingerprint size={16} />
            {registering ? "Registering…" : "Add a passkey for this device"}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}
      {saved && (
        <p className="mt-4 flex items-center gap-1.5 text-sm font-medium text-success">
          <CheckCircle size={16} weight="fill" /> Passkey registered.
        </p>
      )}
    </div>
  );
}
