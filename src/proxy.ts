import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase auth session cookie on every request so admin
// Server Components always see an up-to-date session (per @supabase/ssr's
// documented Next.js App Router pattern). Also gates the guest-facing
// marketing site behind /admin/settings' "Shut Down Website" switch —
// /admin, /api, /portal, /verify, /terms, and /privacy are deliberately
// excluded from that gate: the dashboard must stay usable to reopen the
// site, server-to-server callbacks (M-Pesa/PayPal) must keep working, a
// guest already checked in shouldn't lose their door code/WiFi because of
// an unrelated emergency, and the legal pages should stay reachable
// regardless of site status — a guest with an existing booking, or anyone
// checking policy before the site reopens, shouldn't hit a maintenance
// wall to read them.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  await supabase.auth.getUser();

  if (request.nextUrl.pathname.startsWith("/admin")) {
    return response;
  }

  const { data } = await supabase
    .from("site_content")
    .select("value")
    .eq("key", "site_status")
    .maybeSingle();
  const isOpen = (data?.value as { is_open?: boolean } | null)?.is_open ?? true;

  if (!isOpen) {
    return NextResponse.rewrite(new URL("/maintenance", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/((?!api(?:/|$)|portal(?:/|$)|verify(?:/|$)|maintenance(?:/|$)|terms(?:/|$)|privacy(?:/|$)|_next/static|_next/image|favicon\\.ico).*)",
  ],
};
