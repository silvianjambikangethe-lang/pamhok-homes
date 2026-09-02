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

  // Guest-facing only — the host doesn't need a "chat with us" bubble on
  // their own dashboard. `hidden` lets a specific step (the portal's
  // payment-pending / ID-verification state) suppress it too.
  if (!phone || hidden || pathname?.startsWith("/admin")) return null;

  return (
    <a
      href={whatsappLink(phone, GREETING)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className={`fixed bottom-4 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366] shadow-warm transition-opacity duration-500 hover:opacity-90 sm:bottom-6 sm:right-6 ${
        pastHero ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <WhatsappLogo size={22} weight="fill" className="text-white" />
    </a>
  );
}
