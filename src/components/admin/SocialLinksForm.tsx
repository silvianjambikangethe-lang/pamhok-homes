"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, CheckCircle, Plus, Trash } from "@phosphor-icons/react";
import { SOCIAL_PLATFORMS, getSocialPlatformMeta } from "@/lib/social-icons";
import type { SocialLink } from "@/lib/supabase/types";

export default function SocialLinksForm({ initial }: { initial: SocialLink[] }) {
  const router = useRouter();
  const [links, setLinks] = useState(initial);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [newPlatform, setNewPlatform] = useState(SOCIAL_PLATFORMS[0].value);
  const [newUrl, setNewUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  function urlFor(link: SocialLink) {
    return drafts[link.id] ?? link.url;
  }

  async function patchLink(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/admin/social-links/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not update link.");
      return false;
    }
    return true;
  }

  async function handleSaveUrl(link: SocialLink) {
    const url = urlFor(link).trim();
    if (!url) return;
    const ok = await patchLink(link.id, { url });
    if (ok) {
      setLinks(links.map((l) => (l.id === link.id ? { ...l, url } : l)));
      setSavedId(link.id);
      setTimeout(() => setSavedId(null), 2000);
    }
  }

  async function handleToggleActive(link: SocialLink) {
    const ok = await patchLink(link.id, { is_active: !link.is_active });
    if (ok) {
      setLinks(links.map((l) => (l.id === link.id ? { ...l, is_active: !l.is_active } : l)));
    }
  }

  async function handlePlatformChange(link: SocialLink, platform: string) {
    const ok = await patchLink(link.id, { platform });
    if (ok) {
      setLinks(
        links.map((l) => (l.id === link.id ? { ...l, platform: platform as SocialLink["platform"] } : l)),
      );
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= links.length) return;

    const a = links[index];
    const b = links[target];
    setBusyId(a.id);
    await Promise.all([
      fetch(`/api/admin/social-links/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_order: b.display_order }),
      }),
      fetch(`/api/admin/social-links/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_order: a.display_order }),
      }),
    ]);
    setBusyId(null);

    const reordered = [...links];
    reordered[index] = { ...b, display_order: a.display_order };
    reordered[target] = { ...a, display_order: b.display_order };
    setLinks(reordered);
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/admin/social-links/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (res.ok) {
      setLinks(links.filter((l) => l.id !== id));
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not delete link.");
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newUrl.trim()) return;
    setError(null);
    setBusyId("new");

    const res = await fetch("/api/admin/social-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: newPlatform, url: newUrl.trim() }),
    });
    setBusyId(null);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not add link.");
      return;
    }

    setNewUrl("");
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-taupe/20 bg-surface p-6 shadow-card">
      <h2 className="font-serif text-lg font-semibold text-ink">Social Links</h2>
      <p className="mt-1 text-xs text-ink/65">
        Shown as small icons in the site footer. Only active links are visible to guests.
      </p>

      <div className="mt-4 space-y-3">
        {links.length === 0 && (
          <p className="text-sm text-ink/65">No social links added yet.</p>
        )}
        {links.map((link, index) => {
          const meta = getSocialPlatformMeta(link.platform);
          const Icon = meta?.icon;
          const busy = busyId === link.id;
          return (
            <div
              key={link.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-taupe/20 bg-page p-3"
            >
              {Icon && <Icon size={20} className="shrink-0 text-terracotta-600" />}
              <select
                value={link.platform}
                onChange={(e) => handlePlatformChange(link, e.target.value)}
                disabled={busy}
                className="focus-ring rounded-lg border border-taupe/25 bg-surface px-2.5 py-2 text-sm text-ink"
              >
                {SOCIAL_PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <input
                type="url"
                value={urlFor(link)}
                onChange={(e) => setDrafts({ ...drafts, [link.id]: e.target.value })}
                disabled={busy}
                className="focus-ring min-w-[12rem] flex-1 rounded-lg border border-taupe/25 bg-surface px-3 py-2 text-sm text-ink"
              />
              {urlFor(link) !== link.url && (
                <button
                  type="button"
                  onClick={() => handleSaveUrl(link)}
                  disabled={busy}
                  className="focus-ring rounded-full bg-mocha-500 dark:bg-terracotta-500 px-3 py-1.5 text-xs font-semibold text-mousse dark:text-white hover:bg-mocha-600 dark:hover:bg-terracotta-600 disabled:opacity-60"
                >
                  Save
                </button>
              )}
              {savedId === link.id && (
                <CheckCircle size={16} weight="fill" className="text-success" />
              )}

              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleToggleActive(link)}
                  disabled={busy}
                  className={`focus-ring rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-60 ${
                    link.is_active
                      ? "bg-forest-500 text-ivory-dark dark:bg-sage-500 dark:text-espresso"
                      : "bg-ink/10 text-ink/70"
                  }`}
                >
                  {link.is_active ? "Active" : "Inactive"}
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(index, -1)}
                  disabled={busy || index === 0}
                  aria-label="Move up"
                  className="focus-ring rounded-full p-1.5 text-ink/60 hover:bg-ink/5 disabled:opacity-30"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(index, 1)}
                  disabled={busy || index === links.length - 1}
                  aria-label="Move down"
                  className="focus-ring rounded-full p-1.5 text-ink/60 hover:bg-ink/5 disabled:opacity-30"
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(link.id)}
                  disabled={busy}
                  aria-label="Delete link"
                  className="focus-ring rounded-full p-1.5 text-danger hover:bg-danger/10 disabled:opacity-30"
                >
                  <Trash size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleAdd} className="mt-4 flex flex-wrap items-center gap-2">
        <select
          value={newPlatform}
          onChange={(e) => setNewPlatform(e.target.value as typeof newPlatform)}
          className="focus-ring rounded-lg border border-taupe/25 bg-page px-2.5 py-2 text-sm text-ink"
        >
          {SOCIAL_PLATFORMS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <input
          type="url"
          required
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="https://..."
          className="focus-ring min-w-[12rem] flex-1 rounded-lg border border-taupe/25 bg-page px-3 py-2 text-sm text-ink"
        />
        <button
          type="submit"
          disabled={busyId === "new"}
          className="focus-ring flex items-center gap-1.5 rounded-full border border-taupe/25 px-4 py-2 text-xs font-semibold text-ink/80 hover:border-terracotta-300 disabled:opacity-60"
        >
          <Plus size={14} /> Add Link
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  );
}
