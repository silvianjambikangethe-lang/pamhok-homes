"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import SlideIn from "@/components/SlideIn";
import LazyVideo from "@/components/LazyVideo";

// One single row of portrait videos on every screen size, never wrapping onto
// a second line. When they all fit (wide screens) they simply sit centred;
// when they don't (phones, narrow tablets) the row slides sideways with
// swipe, arrows and dots, snapping one video into place at a time.
export default function TourVideoCarousel({ urls }: { urls: string[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [active, setActive] = useState(0);

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setOverflowing(el.scrollWidth > el.clientWidth + 2);
    // The video whose centre is closest to the middle of the row.
    const mid = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestDistance = Infinity;
    Array.from(el.children).forEach((child, i) => {
      const c = child as HTMLElement;
      const distance = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    setActive(best);
  }, []);

  useEffect(() => {
    measure();
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, urls.length]);

  function goTo(index: number) {
    const el = scroller.current;
    const child = el?.children[index] as HTMLElement | undefined;
    if (!el || !child) return;
    el.scrollTo({
      left: child.offsetLeft - (el.clientWidth - child.offsetWidth) / 2,
      behavior: "smooth",
    });
  }

  const last = urls.length - 1;

  return (
    <div className="relative mt-8">
      <div
        ref={scroller}
        onScroll={measure}
        className="no-scrollbar mx-auto flex w-fit max-w-full snap-x snap-mandatory gap-5 overflow-x-auto px-1 pb-2"
      >
        {urls.map((url, i) => (
          <SlideIn
            key={url}
            className="w-[220px] shrink-0 snap-center"
            delayMs={i * 120}
          >
            <LazyVideo
              src={url}
              className="photo-frame photo-frame-glow aspect-[9/16] w-full rounded-2xl bg-black shadow-card"
            />
          </SlideIn>
        ))}
      </div>

      {overflowing && (
        <>
          <button
            type="button"
            onClick={() => goTo(Math.max(0, active - 1))}
            disabled={active === 0}
            aria-label="Previous video"
            className="focus-ring absolute left-0 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#3A2418] shadow-card transition-opacity disabled:opacity-30 sm:flex"
          >
            <CaretLeft size={20} weight="bold" />
          </button>
          <button
            type="button"
            onClick={() => goTo(Math.min(last, active + 1))}
            disabled={active === last}
            aria-label="Next video"
            className="focus-ring absolute right-0 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#3A2418] shadow-card transition-opacity disabled:opacity-30 sm:flex"
          >
            <CaretRight size={20} weight="bold" />
          </button>

          <div className="mt-4 flex justify-center gap-2" role="tablist" aria-label="Choose a video">
            {urls.map((url, i) => (
              <button
                key={url}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={`Video ${i + 1}`}
                onClick={() => goTo(i)}
                className="focus-ring flex h-6 w-6 items-center justify-center"
              >
                <span
                  className={`h-2 rounded-full transition-all ${
                    i === active ? "w-5 bg-terracotta-600" : "w-2 bg-taupe/40"
                  }`}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
