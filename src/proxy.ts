import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase auth session cookie on every request so admin
// Server Components always see an up-to-date session (per @supabase/ssr's
// documented Next.js App Router pattern). Also gates the guest-facing
// marketing site behind /admin/settings' "Shut Down Website" switch —
// /admin, /staff, /api, /portal, /verify, /terms, /privacy, and /contact
// are deliberately excluded from that gate: the dashboards must stay
// usable to reopen the site (or keep working a shift), server-to-server
// callbacks (M-Pesa/Jenga) must keep working, a guest already checked
// in shouldn't lose their door code/WiFi because of an unrelated
// emergency, and the legal pages plus the contact page (WhatsApp/call/
// email/address) should all stay reachable regardless of site status —
// someone trying to reach the business shouldn't hit a maintenance wall
// just to find its contact details.
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

  if (
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/staff")
  ) {
    await supabase.auth.getUser();
    return response;
  }

  // Guest pages: one flag lookup (uncached, so a shutdown is instant), no auth round trip at all
  // while the site is open (only the closed-site admin bypass needs the
  // user, and public pages never read the session).
  const { data } = await supabase
    .from("site_content")
    .select("value")
    .eq("key", "site_status")
    .maybeSingle();
  const isOpen = (data?.value as { is_open?: boolean } | null)?.is_open ?? true;

  if (!isOpen) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // A signed-in admin still sees the real site while it's closed to
    // everyone else (Settings → "Access Website"). Checked against
    // admin_users, not just "has a session": any Google account can sign in
    // to this project and staff share the same cookie jar, so a session
    // alone proves nothing. Fails closed if the lookup errors.
    if (user) {
      const { data: adminRow } = await supabase
        .from("admin_users")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      if (adminRow) return response;
    }
    return NextResponse.rewrite(new URL("/maintenance", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/staff/:path*",
    "/((?!api(?:/|$)|portal(?:/|$)|verify(?:/|$)|maintenance(?:/|$)|terms(?:/|$)|privacy(?:/|$)|contact(?:/|$)|_next/static|_next/image|favicon\\.ico|icon\\.svg|apple-icon\\.png).*)",
  ],
};
