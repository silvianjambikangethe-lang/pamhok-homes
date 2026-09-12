"use client";

import { useRef, useState } from "react";
import { VideoCamera } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";

const MAX_SIZE = 100 * 1024 * 1024; // 100MB, matches the site-videos bucket's file_size_limit
const ALLOWED_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

// Uploads straight from the browser to Supabase Storage — deliberately
// NOT through a Next.js API route like ImageUploadField uses. Vercel's
// serverless functions cap request bodies at ~4.5MB, far too small for
// video, so this uses the browser's own Supabase client (already
// carrying the admin's session cookie via @supabase/ssr) to write
// directly to the "site-videos" bucket. RLS ("admins manage site
// videos") is what actually enforces authorization here, same as every
// other admin write in this app — there's no server-side check in this
// component itself, matching upload-image/route.ts's own comment that
// RLS, not the route, is the real gate.
export default function VideoUploadField({
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
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please upload an MP4, WebM, or MOV video.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("Video is too large — please keep it under 100MB.");
      return;
    }

    setUploading(true);
    setError(null);

    const supabase = createClient();
    const extension = file.name.split(".").pop() ?? "mp4";
    const objectPath = `${path}-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("site-videos")
      .upload(objectPath, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      setError("Not authorized, or upload failed.");
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("site-videos").getPublicUrl(objectPath);

    // Best-effort — a compression failure shouldn't block the upload the
    // guest-facing page already has a working (if larger) file either
    // way. See /api/admin/compress-video's own comment for why this is a
    // separate call rather than compressing during the upload itself.
    setCompressing(true);
    await fetch("/api/admin/compress-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectPath }),
    }).catch(() => null);

    onUploaded(data.publicUrl);
    setUploading(false);
    setCompressing(false);
  }

  return (
    <div>
      <label className="text-sm font-medium text-ink/80">{label}</label>
      <div className="mt-1.5 flex flex-wrap items-center gap-4">
        {currentUrl ? (
          <video
            src={currentUrl}
            controls
            controlsList="nodownload"
            className="h-44 w-24 rounded-lg border border-taupe/25 bg-black object-cover"
          />
        ) : (
          <div className="flex h-44 w-24 items-center justify-center rounded-lg border border-dashed border-taupe/40 text-ink/40">
            <VideoCamera size={24} />
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
              {compressing
                ? "Compressing…"
                : uploading
                  ? "Uploading…"
                  : currentUrl
                    ? "Replace Video"
                    : "Upload Video"}
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
            accept="video/mp4,video/webm,video/quicktime"
            className="sr-only"
            onChange={handleFile}
          />
          <p className="mt-1 text-xs text-ink/55">MP4, WebM, or MOV. Up to 100MB.</p>
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </div>
      </div>
    </div>
  );
}
