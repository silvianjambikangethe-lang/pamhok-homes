import type { Metadata } from "next";
import Link from "next/link";
import { Broom, CalendarBlank, Clock, TShirt } from "@phosphor-icons/react/dist/ssr";
import { requireStaff } from "@/lib/staff";
import { pageTitle } from "@/lib/site";

export const metadata: Metadata = {
  title: pageTitle("Staff Overview"),
  robots: { index: false, follow: false },
};

export default async function StaffOverviewPage() {
  const { supabase } = await requireStaff();

  const [{ count: cleaningOpen }, { count: laundryOpen }, { count: scheduleToday }] =
    await Promise.all([
      supabase
        .from("staff_cleaning_laundry_feed")
        .select("id", { count: "exact", head: true })
        .eq("request_type", "cleaning")
        .not("status", "in", '("Resolved")'),
      supabase
        .from("staff_cleaning_laundry_feed")
        .select("id", { count: "exact", head: true })
        .eq("request_type", "laundry")
        .not("status", "in", '("Closed")'),
      supabase.from("staff_checkout_schedule").select("booking_id", { count: "exact", head: true }),
    ]);

  const cards = [
    { href: "/staff/cleaning", label: "Cleaning Requests", count: cleaningOpen ?? 0, icon: Broom },
    { href: "/staff/laundry", label: "Laundry Requests", count: laundryOpen ?? 0, icon: TShirt },
    {
      href: "/staff/schedule",
      label: "Checkouts Today/Tomorrow",
      count: scheduleToday ?? 0,
      icon: CalendarBlank,
    },
  ];

  return (
    <div>
      <h1 className="font-serif text-h2 text-ink">Overview</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="focus-ring flex items-center justify-between gap-4 rounded-2xl border border-taupe/20 bg-surface p-6 shadow-card transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-3">
                <Icon size={28} weight="light" className="text-terracotta-600" />
                <span className="font-medium text-ink">{card.label}</span>
              </div>
              <span className="rounded-full bg-forest-700 px-3 py-1 text-sm font-semibold text-white">
                {card.count}
              </span>
            </Link>
          );
        })}
        <Link
          href="/staff/clock"
          className="focus-ring flex items-center gap-3 rounded-2xl border border-taupe/20 bg-surface p-6 shadow-card transition-transform hover:-translate-y-0.5"
        >
          <Clock size={28} weight="light" className="text-terracotta-600" />
          <span className="font-medium text-ink">Clock In/Out</span>
        </Link>
      </div>
    </div>
  );
}
