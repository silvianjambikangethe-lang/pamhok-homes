import { NextResponse } from "next/server";
import { getBookingByToken } from "@/lib/portal";
import { generateReceiptImage } from "@/lib/receipt-image";

// Regenerated on every request rather than stored — a receipt is just a
// formatted view of columns already on the booking row, so there's
// nothing to keep in sync by persisting a copy, and Storage would be one
// more place ID-adjacent guest data could leak from.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const booking = await getBookingByToken(token);

  if (!booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  // Only a genuinely settled payment gets a receipt — total_amount can be
  // bumped ahead of payment clearing while a stay-extension hold is
  // pending (see extend/confirm), so anything short of "Paid" risks
  // handing out a receipt for money that hasn't actually been charged yet.
  if (booking.payment_status !== "Paid") {
    return NextResponse.json(
      { error: "A receipt is available once your payment is confirmed." },
      { status: 409 },
    );
  }

  const imageBytes = await generateReceiptImage({
    guestName: booking.guest?.full_name ?? "Guest",
    roomName: booking.room?.name ?? "Room",
    checkIn: booking.check_in,
    checkOut: booking.check_out,
    bookingReference: booking.booking_reference,
    totalAmount: booking.total_amount,
    currency: booking.currency,
    paymentMethod: booking.payment_method,
    paymentReference: booking.payment_reference,
    paidAt: booking.paid_at,
  });

  return new NextResponse(Buffer.from(imageBytes), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      // "attachment", not "inline" — the point of this route is a
      // one-tap save/share, matching how a guest would already expect to
      // handle an M-Pesa-style payment confirmation image.
      "Content-Disposition": `attachment; filename="receipt-${booking.booking_reference ?? booking.id}.png"`,
      "Cache-Control": "private, no-store",
    },
  });
}
