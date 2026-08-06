"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Calendar,
  ChatCircleDots,
  DeviceMobile,
  DoorOpen,
  Gear,
  House,
  ListChecks,
  PencilSimple,
  Receipt,
  SignOut,
  Star,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { SITE } from "@/lib/site";
import ThemeToggle from "@/components/ThemeToggle";
import TextSizeToggle from "@/components/admin/TextSizeToggle";

const LINKS = [
  { href: "/admin", label: "Overview", icon: House },
  { href: "/admin/bookings", label: "Bookings", icon: ListChecks },
  { href: "/admin/verifications", label: "ID Verifications", icon: Bell },
  { href: "/admin/calendar", label: "Calendar", icon: Calendar },
  { href: "/admin/requests", label: "Guest Requests", icon: ChatCircleDots },
  { href: "/admin/rooms", label: "Room Settings", icon: DoorOpen },
  { href: "/admin/content", label: "Edit Content", icon: PencilSimple },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/expenses", label: "Expenses", icon: Receipt },
  { href: "/admin/whatsapp-setup", label: "WhatsApp Contact", icon: DeviceMobile },
  { href: "/admin/settings", label: "Settings", icon: Gear },
];

export default function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between border-b border-forest-500/40 dark:border-white/10 p-6">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SITE.logoIconUrl} alt={SITE.name} className="h-8 w-8 shrink-0 rounded-md object-cover" />
          <div>
            <p className="font-serif text-lg font-semibold text-white">{SITE.name}</p>
            <p className="mt-0.5 text-xs text-white/60">{email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TextSizeToggle />
          <ThemeToggle colorClassName="text-white hover:bg-forest-500/40 dark:hover:bg-white/10" />
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`focus-ring flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-white text-forest-700"
                  : "text-white/75 hover:bg-forest-500/40 dark:hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon size={18} />
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-forest-500/40 dark:border-white/10 p-4">
        <button
          type="button"
          onClick={handleSignOut}
          className="focus-ring flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/75 transition-colors hover:bg-forest-500/40 dark:hover:bg-white/10 hover:text-white"
        >
          <SignOut size={18} />
          Sign out
        </button>
      </div>
    </div>
  );
}
