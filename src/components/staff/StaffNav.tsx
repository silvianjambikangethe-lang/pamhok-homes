"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Broom,
  CalendarBlank,
  Clock,
  House,
  SignOut,
  TShirt,
  UserSwitch,
} from "@phosphor-icons/react";
import { SITE } from "@/lib/site";

const LINKS = [
  { href: "/staff/overview", label: "Overview", icon: House },
  { href: "/staff/cleaning", label: "Cleaning", icon: Broom },
  { href: "/staff/laundry", label: "Laundry", icon: TShirt },
  { href: "/staff/schedule", label: "Schedule", icon: CalendarBlank },
  { href: "/staff/clock", label: "Clock In/Out", icon: Clock },
];

export default function StaffNav({
  workerName,
  openCount,
}: {
  workerName: string;
  openCount?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSwitchWorker() {
    await fetch("/api/staff/switch-worker", { method: "POST" });
    router.push("/staff");
    router.refresh();
  }

  async function handleSignOut() {
    await fetch("/api/staff/logout", { method: "POST" });
    router.push("/staff/login");
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-1 border-b border-forest-500/40 dark:border-white/10 p-6">
        <p className="font-serif text-lg font-semibold text-white">{SITE.name}</p>
        <p className="text-xs text-white/60">Working as {workerName}</p>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          const Icon = link.icon;
          const showBadge = link.href === "/staff/overview" && (openCount ?? 0) > 0;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`focus-ring flex items-center justify-between gap-3 rounded-lg px-3 py-3 text-base font-medium transition-colors ${
                active
                  ? "bg-white text-forest-700"
                  : "text-white/75 hover:bg-forest-500/40 dark:hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon size={20} />
                {link.label}
              </span>
              {showBadge && (
                <span className="rounded-full bg-terracotta-500 px-2 py-0.5 text-xs font-semibold text-white">
                  {openCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-1 border-t border-forest-500/40 dark:border-white/10 p-4">
        <button
          type="button"
          onClick={handleSwitchWorker}
          className="focus-ring flex w-full items-center gap-3 rounded-lg px-3 py-3 text-base font-medium text-white/75 transition-colors hover:bg-forest-500/40 dark:hover:bg-white/10 hover:text-white"
        >
          <UserSwitch size={20} />
          Switch worker
        </button>
        <button
          type="button"
          onClick={handleSignOut}
          className="focus-ring flex w-full items-center gap-3 rounded-lg px-3 py-3 text-base font-medium text-white/75 transition-colors hover:bg-forest-500/40 dark:hover:bg-white/10 hover:text-white"
        >
          <SignOut size={20} />
          Sign out
        </button>
      </div>
    </div>
  );
}
