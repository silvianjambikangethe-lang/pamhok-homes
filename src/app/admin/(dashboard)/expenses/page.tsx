import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import ExpensesPanel from "@/components/admin/ExpensesPanel";

export const metadata: Metadata = {
  title: "Expenses — Pamhok Homes",
  robots: { index: false, follow: false },
};

export default async function AdminExpensesPage() {
  const supabase = await createServerSupabaseClient();

  const { data: expenses } = await supabase
    .from("business_expenses")
    .select("*")
    .order("next_due_date", { ascending: true });

  return (
    <div>
      <h1 className="font-serif text-h2 text-ink">Expenses</h1>
      <p className="mt-1 text-sm text-ink/80">
        Track your own recurring service bills — domain, hosting, and anything else. Update the
        due date yourself after each renewal; this doesn&apos;t detect payment automatically.
      </p>

      <div className="mt-6">
        <ExpensesPanel initial={expenses ?? []} />
      </div>
    </div>
  );
}
