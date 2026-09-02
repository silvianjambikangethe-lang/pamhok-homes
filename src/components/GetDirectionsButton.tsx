"use client";

import { useState } from "react";
import { MapPin, NavigationArrow } from "@phosphor-icons/react";
import { SITE } from "@/lib/site";

export default function GetDirectionsButton({
  mapsUrl,
  className = "",
  label = "Get Directions",
  // The location pre-prompt only makes sense when Google Maps needs to use
  // the guest's own live position (directions *to* Pamhok Homes from
  // wherever they are). Links that already carry a fixed origin AND
  // destination — e.g. "Pamhok Homes -> a neighborhood place" — don't need
  // it; the route is already fully specified.
  needsLocationPrompt = true,
}: {
  mapsUrl: string | null;
  className?: string;
  label?: string;
  needsLocationPrompt?: boolean;
}) {
  const [showPrompt, setShowPrompt] = useState(false);

  if (!mapsUrl) return null;

  function openMaps() {
    window.open(mapsUrl!, "_blank", "noopener,noreferrer");
  }

  function handleClick() {
    if (!needsLocationPrompt || !("geolocation" in navigator)) {
      openMaps();
      return;
    }
    setShowPrompt(true);
  }

  // We don't use the coordinates ourselves — Google Maps uses the device's
  // own location once it opens. Asking here first just gives the guest a
  // friendly heads-up before the browser's native permission prompt
  // appears, instead of that prompt showing up out of nowhere.
  function handleAllow() {
    setShowPrompt(false);
    navigator.geolocation.getCurrentPosition(openMaps, openMaps, { timeout: 5000 });
  }

  function handleSkip() {
    setShowPrompt(false);
    openMaps();
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`focus-ring flex items-center justify-center gap-2 rounded-full border border-taupe/25 px-5 py-2.5 text-sm font-semibold text-ink/80 transition-colors hover:border-terracotta-300 ${className}`}
      >
        <NavigationArrow size={18} weight="fill" className="text-terracotta-600" />
        {label}
      </button>

      {showPrompt && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Location permission"
          className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/60 p-4"
        >
          <div className="w-full max-w-sm rounded-2xl border border-taupe/20 bg-surface p-6 shadow-warm">
            <MapPin size={28} weight="fill" className="text-terracotta-600" />
            <h2 className="mt-3 font-serif text-h3 text-ink">Enable location?</h2>
            <p className="mt-2 text-sm text-ink/80">
              Allow location access so Google Maps can give you turn-by-turn
              directions to {SITE.name} and track your route as you drive.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleAllow}
                className="focus-ring rounded-full bg-mocha-500 dark:bg-terracotta-500 px-5 py-2.5 text-sm font-semibold text-mousse dark:text-white transition-colors hover:bg-mocha-600 dark:hover:bg-terracotta-600"
              >
                Allow Location &amp; Open Maps
              </button>
              <button
                type="button"
                onClick={handleSkip}
                className="focus-ring rounded-full px-5 py-2.5 text-sm font-semibold text-ink/65 hover:text-ink"
              >
                Not now, just open Maps
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
