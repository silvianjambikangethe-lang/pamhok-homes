"use client";

import { useRef, useState } from "react";
import { Image as ImageIcon } from "@phosphor-icons/react";

export default function ImageUploadField({
  label,
  currentUrl,
  path,
  onUploaded,
  onRemove,
}: {
  label: string;
  currentUrl: string | null;
  path: string;
  onUploaded: (url: string) => void;
  onRemove?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("path", path);

    try {
      const res = await fetch("/api/admin/upload-image", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        setUploading(false);
        return;
      }
      onUploaded(data.url);
      setUploading(false);
    } catch {
      setError("Upload failed. Please try again.");
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="text-sm font-medium text-ink/80">{label}</label>
      <div className="mt-1.5 flex items-center gap-4">
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentUrl}
            alt=""
            className="h-20 w-20 rounded-lg border border-taupe/25 object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-taupe/40 text-ink/40">
            <ImageIcon size={24} />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="focus-ring rounded-full border border-taupe/25 bg-page px-4 py-2 text-xs font-semibold text-ink/80 transition-colors hover:border-terracotta-300 disabled:opacity-60"
            >
              {uploading ? "Uploading…" : currentUrl ? "Replace Image" : "Upload Image"}
            </button>
            {onRemove && currentUrl && (
              <button
                type="button"
                onClick={onRemove}
                disabled={uploading}
                className="focus-ring rounded-full px-3 py-2 text-xs font-semibold text-danger transition-colors hover:bg-danger/10 disabled:opacity-60"
              >
                Remove
              </button>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={handleFile}
          />
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </div>
      </div>
    </div>
  );
}
