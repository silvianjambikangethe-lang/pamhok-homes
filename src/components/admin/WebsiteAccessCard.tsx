import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";

// No API call or token behind this: while the site is closed, proxy.ts lets
// through a visitor only if they hold an admin session, so this is just a
// link that works for you and for nobody else.
export default function WebsiteAccessCard({ isOpen }: { isOpen: boolean }) {
  return (
    <div className="rounded-2xl border border-taupe/20 bg-surface p-6 shadow-warm sm:p-8">
      <h2 className="font-serif text-lg font-semibold text-ink">Access Website</h2>
      <p className="mt-1 text-sm text-ink/70">
        {isOpen
          ? "The site is open to everyone right now. This opens it in a new tab."
          : "The site is closed to visitors, but because you're signed in as the admin you can still open and use it. Nobody else can — visitors keep seeing the closed page."}
      </p>

      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className="focus-ring mt-4 inline-flex items-center gap-2 rounded-full bg-mocha-500 dark:bg-terracotta-500 px-6 py-2.5 text-sm font-semibold text-mousse dark:text-white transition-colors hover:bg-mocha-600 dark:hover:bg-terracotta-600"
      >
        Open website
        <ArrowSquareOut size={16} />
      </a>

      <p className="mt-3 text-xs text-ink/55">
        This only works in a browser where you&apos;re signed in to this dashboard. To see
        exactly what visitors see, open the site in a private window instead.
      </p>
    </div>
  );
}
