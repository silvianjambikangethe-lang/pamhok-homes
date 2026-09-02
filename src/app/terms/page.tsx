import type { Metadata } from "next";
import PageBanner from "@/components/PageBanner";
import { getTermsContent } from "@/lib/data";
import { renderTermsBody } from "@/lib/terms-render";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Terms & Conditions — Pamhok Homes",
  robots: { index: false, follow: false },
};

export default async function TermsPage() {
  const { last_updated, sections } = await getTermsContent();

  return (
    <div>
      <PageBanner color="espresso" eyebrow="Legal" title="Terms & Conditions" />

      <div className="container-page max-w-2xl py-12 sm:py-16">
        <p className="text-sm text-ink/55">Last updated: {last_updated}</p>

        {sections.map((section, index) => (
          <section key={index} className="mt-8">
            <h2 className="font-serif text-h3 text-ink">{section.title}</h2>
            <div className="mt-2 space-y-2 text-body-sm text-ink/80">
              {renderTermsBody(section.body)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
