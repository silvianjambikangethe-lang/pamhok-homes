import type { Metadata } from "next";
import { pageTitle } from "@/lib/site";

// page.tsx here is a Client Component (interactive login form), which
// can't export `metadata` itself — this layout carries it instead. Plain
// title, no description/Open Graph — this page shouldn't inherit the rich
// marketing metadata the root layout sets as its default, and shouldn't
// be indexed or show up as a shareable link at all.
export const metadata: Metadata = {
  title: pageTitle("Admin Login"),
  robots: { index: false, follow: false },
  // Overriding openGraph/twitter explicitly (not just omitting them) —
  // Next.js merges openGraph/twitter per field with the parent's, so
  // leaving `description` out here still pulls in the marketing copy
  // (confirmed live); the image is dropped simply by never setting one.
  openGraph: { title: pageTitle("Admin Login"), description: "Admin sign-in for Pamhok Homes." },
  twitter: { title: pageTitle("Admin Login"), description: "Admin sign-in for Pamhok Homes." },
};

export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
