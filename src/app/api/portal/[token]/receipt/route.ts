import { NextResponse } from "next/server";
import { getBookingByToken } from "@/lib/portal";
import { generateReceiptPdf } from "@/lib/receipt";

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

  const pdfBytes = await generateReceiptPdf({
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

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="receipt-${booking.booking_reference ?? booking.id}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
