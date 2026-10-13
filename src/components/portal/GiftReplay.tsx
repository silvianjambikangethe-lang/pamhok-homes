"use client";

import { useState } from "react";
import { ArrowClockwise } from "@phosphor-icons/react";
import ThankYouGift from "@/components/portal/ThankYouGift";

// Keeps the full thank-you gift's replay option reachable from the
// "thanks for staying" view too, not just in the moment right after the
// review is submitted (that first play auto-starts and offers its own
// Gift Replay button, but both disappear the moment the page settles
// into its checked-out state). ThankYouGift auto-plays ~700ms after it
// mounts, so it's only mounted once this button is actually clicked.
export default function GiftReplay() {
  const [playing, setPlaying] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setPlaying(true)}
        disabled={playing}
        className="focus-ring mt-1 flex w-fit items-center gap-1.5 rounded-full border border-taupe/25 px-3.5 py-1.5 text-xs font-medium text-ink/75 transition-colors hover:bg-page hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        <ArrowClockwise size={14} />
        Replay our thank-you gift
      </button>
      {playing && <ThankYouGift onFinished={() => setPlaying(false)} />}
    </>
  );
}
