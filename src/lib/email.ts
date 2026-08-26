import "server-only";
import { Resend } from "resend";

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

// Resend's own shared test/default sender — works with zero setup, no
// domain verification needed. Swap to a real address (e.g.
// bookings@pamhok.com) via EMAIL_FROM_ADDRESS once the owner verifies
// pamhok.com's DNS records with Resend.
function fromAddress() {
  return process.env.EMAIL_FROM_ADDRESS ?? "Pamhok Homes <onboarding@resend.dev>";
}

let client: Resend | null = null;
function getClient(): Resend {
  if (!client) client = new Resend(process.env.RESEND_API_KEY!);
  return client;
}

function wrapper(bodyHtml: string): string {
  return `<div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #2a2118;">
    <h1 style="font-size: 20px; margin-bottom: 4px;">Pamhok Homes</h1>
    ${bodyHtml}
    <p style="margin-top: 24px; font-size: 13px; color: #8a7d6e;">
      Near Thika Road Mall (TRM), Nairobi, Kenya · +254 704 393 189
    </p>
  </div>`;
}

export function bookingConfirmationEmail({
  guestName,
  roomName,
  checkIn,
  checkOut,
  bookingReference,
  portalUrl,
}: {
  guestName: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  bookingReference: string | null;
  portalUrl: string;
}) {
  return {
    subject: `Booking received — ${roomName}, ${checkIn} to ${checkOut}`,
    html: wrapper(`
      <p>Hi ${guestName},</p>
      <p>Thanks for booking with us! Here's a summary of your request:</p>
      <ul>
        <li><strong>Room:</strong> ${roomName}</li>
        <li><strong>Check-in:</strong> ${checkIn}</li>
        <li><strong>Check-out:</strong> ${checkOut}</li>
        ${bookingReference ? `<li><strong>Reference:</strong> ${bookingReference}</li>` : ""}
      </ul>
      <p>Head to your booking page to complete ID verification and payment:</p>
      <p><a href="${portalUrl}" style="color: #a15c3e;">${portalUrl}</a></p>
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
  const message =
    type === "evening-before"
      ? "Just a heads-up — your stay wraps up tomorrow."
      : "Checkout is today. Please confirm your checkout on your booking page whenever you're ready to head out.";
  return {
    subject: type === "evening-before" ? "Checkout tomorrow" : "Checkout today",
    html: wrapper(`
      <p>Hi ${guestName},</p>
      <p>${message}</p>
      <p><strong>Room:</strong> ${roomName}</p>
      <p><a href="${portalUrl}" style="color: #a15c3e;">${portalUrl}</a></p>
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
      <p><a href="${portalUrl}" style="color: #a15c3e;">${portalUrl}</a></p>
    `),
  };
}

// Best-effort send — callers should not fail the calling operation (a
// booking, a cron run) just because an email didn't go out. Logs and
// swallows errors rather than throwing.
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  if (!isEmailConfigured()) return false;

  try {
    const { error } = await getClient().emails.send({
      from: fromAddress(),
      to,
      subject,
      html,
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
