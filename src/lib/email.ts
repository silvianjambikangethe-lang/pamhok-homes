import "server-only";
import { Resend } from "resend";
import { SITE } from "@/lib/site";

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

// pamhokhomes.com is verified on Resend — set EMAIL_FROM_ADDRESS to an
// address on it (e.g. bookings@pamhokhomes.com) in every environment that
// sends. Falls back to Resend's shared onboarding@resend.dev sender, which
// only delivers to the Resend account's own signup address — fine for
// local dev/testing, not for real guests.
function fromAddress() {
  return process.env.EMAIL_FROM_ADDRESS ?? "Pamhok Homes <onboarding@resend.dev>";
}

let client: Resend | null = null;
function getClient(): Resend {
  if (!client) client = new Resend(process.env.RESEND_API_KEY!);
  return client;
}

// Fraunces (headings) + Plus Jakarta Sans (body) match the site's own
// next/font choices (see README's "master-color-scheme" references) — a
// serif/sans pairing for a "warm, homey" feel rather than a generic
// notification. The @import degrades gracefully to the Georgia/system
// fallback stacks in clients that don't load it (older Outlook).
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

function link(url: string): string {
  return `<p style="margin: 8px 0;"><a href="${url}" style="color:#8C4A23;">${url}</a></p>`;
}

// Every other template's interpolated values (guest names, room names,
// dates) come from the database, already constrained by their own input
// validation at write time. The contact form is different — it's raw,
// open-ended visitor text with no such constraint — so escape it before
// it goes into an HTML email body, or a submitted "<script>..." or
// similarly crafted message would render as live HTML in whatever mail
// client opens it.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function bookingConfirmationEmail({
  guestName,
  roomName,
  checkIn,
  checkOut,
  bookingReference,
  amountPaid,
  currency,
  portalUrl,
}: {
  guestName: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  bookingReference: string | null;
  amountPaid: number;
  currency: string;
  portalUrl: string;
}) {
  const amountText = new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountPaid);

  return {
    subject: `Payment confirmed — ${roomName}, ${checkIn} to ${checkOut}`,
    html: wrapper(`
      <p>Hi ${guestName},</p>
      <p>Your payment is confirmed and your stay is booked. Here's your summary:</p>
      <ul style="padding-left: 18px;">
        <li><strong>Room:</strong> ${roomName}</li>
        <li><strong>Check-in:</strong> ${checkIn}</li>
        <li><strong>Check-out:</strong> ${checkOut}</li>
        <li><strong>Paid:</strong> ${amountText}</li>
        ${bookingReference ? `<li><strong>Reference:</strong> ${bookingReference}</li>` : ""}
      </ul>
      <p>Your door code and WiFi details will be ready on your booking page once your ID is verified (if it isn't already):</p>
      ${button(portalUrl, "View my booking")}
    `),
  };
}

export function stayExtensionConfirmationEmail({
  guestName,
  roomName,
  newCheckOut,
  totalPaid,
  currency,
  portalUrl,
}: {
  guestName: string;
  roomName: string;
  newCheckOut: string;
  totalPaid: number;
  currency: string;
  portalUrl: string;
}) {
  // totalPaid is the full re-confirmed total for the extended stay, not an
  // isolated "extension only" charge — the booking flow re-opens payment
  // for the whole updated total rather than tracking a separate line item
  // (see extend/confirm/route.ts), so the copy here stays accurate to that.
  const amountText = new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(totalPaid);

  return {
    subject: `Stay extended — new checkout ${newCheckOut}`,
    html: wrapper(`
      <p>Hi ${guestName},</p>
      <p>Your extension is confirmed! We've updated your stay in ${roomName}.</p>
      <ul style="padding-left: 18px;">
        <li><strong>New checkout date:</strong> ${newCheckOut}</li>
        <li><strong>Total confirmed for your stay:</strong> ${amountText}</li>
      </ul>
      ${button(portalUrl, "View my booking")}
    `),
  };
}

export function idVerificationResultEmail({
  guestName,
  roomName,
  portalUrl,
  status,
  refundNote,
}: {
  guestName: string;
  roomName: string;
  portalUrl: string;
  status: "Verified" | "Rejected";
  refundNote?: string | null;
}) {
  if (status === "Verified") {
    return {
      subject: "You're verified!",
      html: wrapper(`
        <p>Hi ${guestName},</p>
        <p>Good news — your ID has been verified for your stay in ${roomName}. If you haven't paid yet, you're clear to complete payment now; your door code and WiFi will appear on your booking page right after.</p>
        ${button(portalUrl, "View my booking")}
      `),
    };
  }

  return {
    subject: "We couldn't verify your ID",
    html: wrapper(`
      <p>Hi ${guestName},</p>
      <p>We weren't able to verify the ID you uploaded for your stay in ${roomName}. Please upload a clearer photo of your ID and a selfie to try again.</p>
      ${refundNote ? `<p>${refundNote}</p>` : ""}
      ${button(portalUrl, "Re-upload my ID")}
    `),
  };
}

export function checkoutReminderEmail({
  guestName,
  roomName,
  type,
  portalUrl,
}: {
  guestName: string;
  roomName: string;
  type: "evening-before" | "checkout-morning";
  portalUrl: string;
}) {
  if (type === "evening-before") {
    return {
      subject: "Checkout is tomorrow",
      html: wrapper(`
        <p>Hi ${guestName},</p>
        <p>Just a heads-up — your stay in ${roomName} wraps up tomorrow.</p>
        <p>Loving it here? You can extend your stay right from your booking page.</p>
        ${button(portalUrl, "Extend my stay")}
      `),
    };
  }

  return {
    subject: "Checkout is today",
    html: wrapper(`
      <p>Hi ${guestName},</p>
      <p><strong>Checkout is today.</strong> Please confirm your checkout on your booking page whenever you're ready to head out — our cleaning team will be by shortly after.</p>
      ${button(portalUrl, "Confirm checkout")}
    `),
  };
}

export function cleaningNoticeEmail({
  guestName,
  roomName,
  portalUrl,
}: {
  guestName: string;
  roomName: string;
  portalUrl: string;
}) {
  return {
    subject: "Cleaning today",
    html: wrapper(`
      <p>Hi ${guestName},</p>
      <p>Our cleaning team will visit your room, ${roomName}, today.</p>
      ${link(portalUrl)}
    `),
  };
}

const LAUNDRY_MESSAGES: Record<string, string> = {
  "Picked Up": "Your laundry has been picked up.",
  Cleaning: "Your laundry is being cleaned.",
  Ready: "Your laundry is ready.",
  Returned: "Your laundry has been returned to your room.",
};

export function laundryStatusEmail({
  guestName,
  stage,
  portalUrl,
}: {
  guestName: string;
  stage: "Picked Up" | "Cleaning" | "Ready" | "Returned";
  portalUrl: string;
}) {
  return {
    subject: `Laundry update: ${stage}`,
    html: wrapper(`
      <p>Hi ${guestName},</p>
      <p>${LAUNDRY_MESSAGES[stage]}</p>
      ${link(portalUrl)}
    `),
  };
}

export function checkoutCompleteEmail({
  guestName,
  roomName,
  portalUrl,
}: {
  guestName: string;
  roomName: string;
  portalUrl: string;
}) {
  return {
    subject: "Thanks for staying with us!",
    html: wrapper(`
      <p>Hi ${guestName},</p>
      <p>Thanks for staying with us in ${roomName} — we hope it felt like home. If you have a minute, we'd love to hear how it went.</p>
      ${button(portalUrl, "Leave a review")}
    `),
  };
}

export function contactMessageEmail({
  name,
  email,
  message,
}: {
  name: string;
  email: string;
  message: string;
}) {
  return {
    subject: `New contact message from ${escapeHtml(name)}`,
    html: wrapper(`
      <p><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}) sent a message via the Contact page:</p>
      <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
      <p style="margin-top:24px; font-size:13px; color:#8a7d6e;">Reply to this email to respond directly to them.</p>
    `),
  };
}

// Best-effort send — callers should not fail the calling operation (a
// booking, a cron run) just because an email didn't go out. Logs and
// swallows errors rather than throwing.
//
// replyTo defaults to SITE.contactEmail (hello@pamhokhomes.com, a real
// monitored Zoho mailbox) so a guest hitting "Reply" on any automated
// notification reaches a real inbox, not the from-address the mail was
// sent under. Override it (e.g. the contact form does, to the visitor's
// own address) when a reply should go somewhere else instead.
export async function sendEmail({
  to,
  subject,
  html,
  replyTo = SITE.contactEmail,
}: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<boolean> {
  if (!isEmailConfigured()) return false;

  try {
    const { error } = await getClient().emails.send({
      from: fromAddress(),
      to,
      subject,
      html,
      replyTo,
    });
    if (error) {
      console.error("Resend send failed:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Resend send threw:", err);
    return false;
  }
}
