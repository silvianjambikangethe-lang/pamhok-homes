"use client";

import { useRef, useState } from "react";
import { Play } from "@phosphor-icons/react";

// Shows a video as a still frame with a play button, and only downloads the
// full file when the visitor taps play. The first frame comes from the
// video itself (preload="metadata" plus the #t=0.1 media fragment), so
// there is no separate poster image to generate, store or keep in sync, and
// it works for any video added later. An animated GIF of the same clip
// would be several times larger than the mp4, which is the opposite of
// saving storage and bandwidth.
export default function LazyVideo({
  src,
  className = "",
}: {
  src: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  function start() {
    setStarted(true);
    const video = ref.current;
    if (!video) return;
    video.preload = "auto";
    void video.play().catch(() => {
      // Playback blocked: native controls are shown, the visitor can press play.
    });
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <video
        ref={ref}
        src={`${src}#t=0.1`}
        controls={started}
        controlsList="nodownload"
        preload="metadata"
        playsInline
        className="h-full w-full bg-black object-cover"
      />
      {!started && (
        <button
          type="button"
          onClick={start}
          aria-label="Play video"
          className="focus-ring absolute inset-0 flex items-center justify-center bg-black/15 transition-colors hover:bg-black/25"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-[#3A2418] shadow-card">
            <Play size={26} weight="fill" className="ml-0.5" />
          </span>
        </button>
      )}
    </div>
  );
}
