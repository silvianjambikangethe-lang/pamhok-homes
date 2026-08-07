"use client";

import Link from "next/link";
import { useState } from "react";
import { List, X } from "@phosphor-icons/react";
import { NAV_LINKS, SITE } from "@/lib/site";
import ThemeToggle from "@/components/ThemeToggle";

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-taupe/25 bg-page/90 backdrop-blur">
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
          <span className="font-serif text-xl font-semibold text-forest-700 dark:text-ivory-dark sm:text-2xl">
            {SITE.name}
          </span>
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="focus-ring rounded-md text-sm font-medium text-ink/80 transition-colors hover:text-terracotta-600"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          <Link
            href="/rooms"
            className="focus-ring inline-flex items-center rounded-full bg-mocha-500 dark:bg-terracotta-500 px-5 py-2.5 text-sm font-semibold text-mousse dark:text-white shadow-card transition-colors hover:bg-mocha-600 dark:hover:bg-terracotta-600"
          >
            Check Availability
          </Link>
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            className="focus-ring -mr-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-forest-700 dark:text-ivory-dark"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={24} /> : <List size={24} />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-taupe/25 bg-page lg:hidden">
          <div className="container-page flex flex-col gap-1 py-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="focus-ring rounded-md px-2 py-3 text-base font-medium text-ink/80 hover:bg-surface"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/rooms"
              onClick={() => setOpen(false)}
              className="focus-ring mt-2 inline-flex items-center justify-center rounded-full bg-mocha-500 dark:bg-terracotta-500 px-5 py-3 text-sm font-semibold text-mousse dark:text-white"
            >
              Check Availability
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
