"use client";

import { Trash } from "@phosphor-icons/react";
import VideoUploadField from "@/components/admin/VideoUploadField";

// A variable-length list of videos (homepage tour, About Us) — same
// add/remove-by-index shape as NeighborhoodContentForm's CategoryEditor,
// simplified since each item here is just a URL string rather than a
// richer object. Editing one in place isn't supported on purpose: remove
// + re-upload is simpler UX for a short list of short clips, and matches
// how ImageUploadField/VideoUploadField already only support replace-
// via-re-upload, never in-place trimming/editing.
export default function VideoListField({
  label,
  urls,
  pathPrefix,
  onChange,
}: {
  label: string;
  urls: string[];
  pathPrefix: string;
  onChange: (urls: string[]) => void;
}) {
  function removeAt(index: number) {
    onChange(urls.filter((_, i) => i !== index));
  }

  return (
    <div>
      <label className="text-sm font-medium text-ink/80">{label}</label>

      {urls.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-3">
          {urls.map((url, index) => (
            <div key={url} className="relative">
              <video
                src={url}
                controls
                controlsList="nodownload"
                className="h-44 w-24 rounded-lg border border-taupe/25 bg-black object-cover"
              />
              <button
                type="button"
                onClick={() => removeAt(index)}
                aria-label="Remove video"
                className="focus-ring absolute -right-2 -top-2 rounded-full bg-danger p-1.5 text-white shadow"
              >
                <Trash size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3">
        <VideoUploadField
          label={urls.length > 0 ? "Add another video" : "Add a video"}
          currentUrl={null}
          path={`${pathPrefix}-${urls.length}`}
          onUploaded={(url) => onChange([...urls, url])}
        />
      </div>
    </div>
  );
}
