"use client";

import { useEffect, useRef } from "react";

// Slides its children up into place (with a fade) the first time they scroll
// into view. Content already on screen at load, or scrolled past, is left
// alone, and nothing animates for visitors who prefer reduced motion. The
// hidden starting state is only applied from the browser, after the page has
// rendered, so the content is always visible if scripts don't run.
export default function SlideIn({
  children,
  className = "",
  delayMs = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Scrolled past already (e.g. the page reopened further down): nothing
    // to reveal. Anything on screen or below plays the slide-in — on screen
    // it plays right away, below it plays when scrolled to.
    if (el.getBoundingClientRect().bottom < 0) return;

    el.style.opacity = "0";
    el.style.transform = "translateY(56px)";
    el.style.transition = `opacity 700ms ease-out ${delayMs}ms, transform 700ms ease-out ${delayMs}ms`;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.style.opacity = "1";
        el.style.transform = "none";
        observer.disconnect();
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delayMs]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
