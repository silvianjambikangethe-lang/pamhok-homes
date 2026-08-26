// Resend sender for Edge Functions — a deliberate duplicate of
// src/lib/email.ts's booking-confirmation/extension templates, not a
// shared import: Deno Edge Functions can't import Next.js application
// code, so the two are kept visually consistent by hand instead. If you
// change the copy or styling in src/lib/email.ts's bookingConfirmationEmail
// or stayExtensionConfirmationEmail, mirror the change here too.
//
// Requires the RESEND_API_KEY and (optionally) EMAIL_FROM_ADDRESS Supabase
// secrets — same values as the Next.js side's .env.local/Vercel env vars.

function fromAddress(): string {
  return Deno.env.get("EMAIL_FROM_ADDRESS") ?? "Pamhok Homes <onboarding@resend.dev>";
}

function wrapper(bodyHtml: string): string {
  return `<div style="background:#FBF7F1; padding:32px 16px;">
    <style>@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600&family=Plus+Jakarta+Sans:wght@400;600&display=swap');</style>
    <div style="font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #2a2118; font-size: 15px; line-height: 1.6;">
      <h1 style="font-family: Fraunces, Georgia, serif; font-weight: 600; font-size: 22px; margin: 0 0 20px;">Pamhok Homes</h1>
      ${bodyHtml}
      <p style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #EBDFC6; font-size: 13px; color: #8a7d6e;">
        Near Thika Road Mall (TRM), Nairobi, Kenya · +254 704 393 189
      </p>
    </div>
  </div>`;
}

function button(url: string, label: string): string {
  return `<p style="margin: 24px 0;">
    <a href="${url}" style="display:inline-block; background:#C4713C; color:#ffffff; padding:12px 28px; border-radius:999px; text-decoration:none; font-weight:600; font-size:14px;">${label}</a>
  </p>`;
}

export async function sendPaymentSucceededEmail(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  bookingId: string,
  wasAlreadyPaid: boolean,
): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return;

  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "check_in, check_out, total_amount, currency, booking_reference, access_token, guest:guests(full_name, email), room:rooms(name)",
    )
    .eq("id", bookingId)
    .maybeSingle();

  const guest = booking?.guest as { full_name: string; email: string | null } | null;
  if (!booking || !guest?.email) return;

  const siteUrl = Deno.env.get("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000";
  const portalUrl = `${siteUrl}/portal/${booking.access_token}`;
  const roomName = (booking.room as { name?: string } | null)?.name ?? "your room";
  const amountText = new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: booking.currency,
    maximumFractionDigits: 0,
  }).format(booking.total_amount);

  const { subject, html } = wasAlreadyPaid
    ? {
        subject: `Stay extended — new checkout ${booking.check_out}`,
        html: wrapper(`
          <p>Hi ${guest.full_name},</p>
          <p>Your extension is confirmed! We've updated your stay in ${roomName}.</p>
          <ul style="padding-left: 18px;">
            <li><strong>New checkout date:</strong> ${booking.check_out}</li>
            <li><strong>Total confirmed for your stay:</strong> ${amountText}</li>
          </ul>
          ${button(portalUrl, "View my booking")}
        `),
      }
    : {
        subject: `Payment confirmed — ${roomName}, ${booking.check_in} to ${booking.check_out}`,
        html: wrapper(`
          <p>Hi ${guest.full_name},</p>
          <p>Your payment is confirmed and your stay is booked. Here's your summary:</p>
          <ul style="padding-left: 18px;">
            <li><strong>Room:</strong> ${roomName}</li>
            <li><strong>Check-in:</strong> ${booking.check_in}</li>
            <li><strong>Check-out:</strong> ${booking.check_out}</li>
            <li><strong>Paid:</strong> ${amountText}</li>
            ${booking.booking_reference ? `<li><strong>Reference:</strong> ${booking.booking_reference}</li>` : ""}
          </ul>
          <p>Your door code and WiFi details will be ready on your booking page once your ID is verified (if it isn't already):</p>
          ${button(portalUrl, "View my booking")}
        `),
      };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: fromAddress(), to: guest.email, subject, html }),
    });
    if (!res.ok) console.error("Resend send failed:", await res.text());
  } catch (err) {
    console.error("Resend send threw:", err);
  }
}
