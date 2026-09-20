"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { List, X } from "@phosphor-icons/react";
import { NAV_LINKS, SITE } from "@/lib/site";
import ThemeToggle from "@/components/ThemeToggle";

// Theme-toggle colours on the dark-brown homepage header (dark mode falls
// back to the toggle's usual colours).
const HOME_TOGGLE =
  "text-pk-on-dark hover:bg-pk-primary dark:text-ink dark:hover:bg-surface";

export default function Header() {
  const [open, setOpen] = useState(false);
  // On the homepage and on an individual room page (/rooms/<slug>, not the
  // /rooms search page) the header is dark brown with light text in light
  // mode; every other page, and dark mode, keep the original header.
  const pathname = usePathname();
  const darkHeader = pathname === "/" || pathname.startsWith("/rooms/");

  return (
    <header
      className={`sticky top-0 z-40 border-b backdrop-blur ${
        darkHeader
          ? "border-pk-footer bg-pk-footer dark:border-taupe/25 dark:bg-page/90"
          : "border-taupe/25 bg-page/90"
      }`}
    >
      <div className="container-page flex h-16 items-center justify-between sm:h-20">
        <Link
          href="/"
          className="focus-ring flex items-center gap-2.5 rounded-md"
          onClick={() => setOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={SITE.logoIconUrl}
            alt=""
            className="h-11 w-11 rounded-full sm:h-12 sm:w-12"
          />
          <span
            className={`font-serif text-xl font-semibold sm:text-2xl dark:text-ivory-dark ${
              darkHeader ? "text-pk-on-dark" : "text-forest-700"
            }`}
          >
            {SITE.name}
          </span>
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`focus-ring rounded-md text-sm font-medium transition-colors ${
                darkHeader
                  ? "text-pk-on-dark-muted hover:text-pk-on-dark dark:text-ink/80 dark:hover:text-terracotta-600"
                  : "text-ink/80 hover:text-terracotta-600"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle colorClassName={darkHeader ? HOME_TOGGLE : undefined} />
          <Link
            href="/rooms"
            className={`focus-ring inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold shadow-card transition-colors dark:bg-terracotta-500 dark:text-white dark:hover:bg-terracotta-600 ${
              darkHeader
                ? "bg-pk-latte text-pk-text hover:bg-pk-tan"
                : "bg-mocha-500 text-mousse hover:bg-mocha-600"
            }`}
          >
            Check Availability
          </Link>
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <ThemeToggle colorClassName={darkHeader ? HOME_TOGGLE : undefined} />
          <button
            type="button"
            className={`focus-ring -mr-2 inline-flex h-11 w-11 items-center justify-center rounded-full dark:text-ivory-dark ${
              darkHeader ? "text-pk-on-dark" : "text-forest-700"
            }`}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={24} /> : <List size={24} />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          className={`border-t lg:hidden ${
            darkHeader
              ? "border-pk-primary bg-pk-footer dark:border-taupe/25 dark:bg-page"
              : "border-taupe/25 bg-page"
          }`}
        >
          <div className="container-page flex flex-col gap-1 py-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`focus-ring rounded-md px-2 py-3 text-base font-medium ${
                  darkHeader
                    ? "text-pk-on-dark-muted hover:bg-pk-primary hover:text-pk-on-dark dark:text-ink/80 dark:hover:bg-surface"
                    : "text-ink/80 hover:bg-surface"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/rooms"
              onClick={() => setOpen(false)}
              className={`focus-ring mt-2 inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold dark:bg-terracotta-500 dark:text-white ${
                darkHeader ? "bg-pk-latte text-pk-text" : "bg-mocha-500 text-mousse"
              }`}
            >
              Check Availability
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
