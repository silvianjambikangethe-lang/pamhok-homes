"use client";

import { useState } from "react";
import { CheckCircle, Warning } from "@phosphor-icons/react";

export interface MapsLinkValue {
  maps_url: string | null;
  lat: number | null;
  lng: number | null;
}

export default function MapsLinkField({
  label,
  value,
  onChange,
  inputBg = "bg-page",
}: {
  label: string;
  value: MapsLinkValue;
  onChange: (next: MapsLinkValue) => void;
  inputBg?: string;
}) {
  const [url, setUrl] = useState(value.maps_url ?? "");
  const [status, setStatus] = useState<"idle" | "resolving" | "ok" | "error">(
    value.maps_url && value.lat != null && value.lng != null ? "ok" : "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function resolve(nextUrl: string) {
    const trimmed = nextUrl.trim();
    if (!trimmed) {
      setStatus("idle");
      setError(null);
      onChange({ maps_url: null, lat: null, lng: null });
      return;
    }
    // Already resolved this exact link on a previous blur — nothing to redo.
    if (trimmed === value.maps_url && value.lat != null && value.lng != null) {
      setStatus("ok");
      return;
    }

    setStatus("resolving");
    setError(null);
    try {
      const res = await fetch("/api/admin/resolve-maps-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setStatus("error");
        setError(data?.error ?? "Could not check this link.");
        onChange({ maps_url: trimmed, lat: null, lng: null });
        return;
      }
      setStatus("ok");
      onChange({ maps_url: trimmed, lat: data.lat, lng: data.lng });
    } catch {
      setStatus("error");
      setError("Could not reach the server to check this link.");
    }
  }

  return (
    <div>
      <label className="text-sm font-medium text-ink/80">{label}</label>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={() => resolve(url)}
          placeholder="https://maps.app.goo.gl/…"
          className={`focus-ring w-full rounded-lg border border-gold-500/25 ${inputBg} px-3.5 py-2.5 text-sm text-ink`}
        />
        {status === "resolving" && (
          <span className="shrink-0 text-xs text-ink/55">Checking…</span>
        )}
        {status === "ok" && (
          <CheckCircle size={20} weight="fill" className="shrink-0 text-success" />
        )}
        {status === "error" && <Warning size={20} className="shrink-0 text-danger" />}
      </div>
      {status === "ok" && <p className="mt-1 text-xs text-success">Location found.</p>}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
