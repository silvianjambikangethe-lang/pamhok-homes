"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { WhatsappLogo } from "@phosphor-icons/react";
import { SITE, whatsappLink } from "@/lib/site";
import { useWhatsappVisibility } from "@/components/WhatsappVisibilityContext";

const GREETING = `Hello there. Welcome to ${SITE.name}. How may I help you?`;

export default function WhatsappFloatButton({ phone }: { phone: string | null }) {
  const pathname = usePathname();
  const { hidden } = useWhatsappVisibility();
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    function onScroll() {
      setPastHero(window.scrollY > 100);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Guest-facing only — the host/staff don't need a "chat with us" bubble
  // on their own dashboards. `hidden` lets a specific step (the portal's
  // payment-pending / ID-verification state) suppress it too.
  if (!phone || hidden || pathname?.startsWith("/admin") || pathname?.startsWith("/staff")) {
    return null;
  }

  return (
    <a
      href={whatsappLink(phone, GREETING)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className={`fixed bottom-4 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full border-2 border-mocha-500 bg-surface/80 shadow-[0_0_14px_2px_rgba(111,78,55,0.45)] backdrop-blur-sm transition-all duration-500 hover:shadow-[0_0_20px_4px_rgba(111,78,55,0.65)] dark:border-terracotta-500 dark:shadow-[0_0_14px_2px_rgba(196,113,60,0.45)] dark:hover:shadow-[0_0_20px_4px_rgba(196,113,60,0.65)] sm:bottom-6 sm:right-6 ${
        pastHero ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <WhatsappLogo size={22} weight="fill" className="text-mocha-500 dark:text-terracotta-500" />
    </a>
  );
}
