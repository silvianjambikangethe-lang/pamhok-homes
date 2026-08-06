import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import ReviewsManager from "@/components/admin/ReviewsManager";

export const metadata: Metadata = {
  title: "Reviews — Pamhok Homes",
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
        Feature a review to show it on the homepage. Unfeatured reviews still
        exist, they just don&apos;t appear publicly there.
      </p>

      <div className="mt-6">
        <ReviewsManager reviews={reviews ?? []} />
      </div>
    </div>
  );
}
