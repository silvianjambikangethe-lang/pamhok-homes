import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import ReviewsManager from "@/components/admin/ReviewsManager";
import { pageTitle } from "@/lib/site";

export const metadata: Metadata = {
  title: pageTitle("Reviews"),
  robots: { index: false, follow: false },
};

export default async function AdminReviewsPage() {
  const supabase = await createServerSupabaseClient();

  const { data: reviews } = await supabase
    .from("reviews")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-serif text-h2 text-ink">Reviews</h1>
      <p className="mt-1 text-sm text-ink/70">
        Reviews of 3.5 stars and up feature themselves automatically (4.5+
        with their written comment shown, 3.5–4.4 as a rating only).
        You can still feature, un-feature, or delete any review by hand.
        Unfeatured reviews still exist, they just don&apos;t appear publicly.
      </p>

      <div className="mt-6">
        <ReviewsManager reviews={reviews ?? []} />
      </div>
    </div>
  );
}
