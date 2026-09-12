import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { SITE } from "@/lib/site";
import { formatMoney } from "@/lib/currency-format";

export interface ReceiptData {
  guestName: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  bookingReference: string | null;
  totalAmount: number;
  currency: string;
  paymentMethod: string | null;
  paymentReference: string | null;
  paidAt: string | null;
}

// Brand colors pulled from the same terracotta/cocoa palette the emails
// and site already use (see wrapper()/button() in email.ts) — kept as a
// small in-file constant rather than importing Tailwind config, since
// pdf-lib needs raw 0-1 RGB values, not CSS strings.
const INK = rgb(0.16, 0.13, 0.09);
const MUTED = rgb(0.54, 0.49, 0.43);
const TERRACOTTA = rgb(0.77, 0.44, 0.24);

// A single-page, static-layout receipt — deliberately hand-positioned
// with pdf-lib rather than an HTML-to-PDF renderer (Puppeteer/Chromium),
// which would be a much heavier dependency for one fixed-layout page with
// no dynamic content that needs real layout flow.
export async function generateReceiptPdf(data: ReceiptData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const marginX = 56;
  let y = height - 64;

  const drawText = (
    text: string,
    options: { x?: number; size?: number; f?: typeof font; color?: ReturnType<typeof rgb> } = {},
  ) => {
    page.drawText(text, {
      x: options.x ?? marginX,
      y,
      size: options.size ?? 11,
      font: options.f ?? font,
      color: options.color ?? INK,
    });
  };

  // Header
  drawText(SITE.name, { size: 20, f: bold, color: TERRACOTTA });
  y -= 18;
  drawText(SITE.address, { size: 9, color: MUTED });
  y -= 12;
  drawText(`${SITE.contactEmail} · ${SITE.phone}`, { size: 9, color: MUTED });
  y -= 36;

  drawText("PAYMENT RECEIPT", { size: 14, f: bold });
  y -= 20;

  const nights = Math.max(
    1,
    differenceInCalendarDays(parseISO(data.checkOut), parseISO(data.checkIn)),
  );
  const paidDate = data.paidAt
    ? format(parseISO(data.paidAt), "d MMMM yyyy")
    : "—";

  const rows: [string, string][] = [
    ["Receipt for", data.guestName],
    ["Booking reference", data.bookingReference ?? "—"],
    ["Room", data.roomName],
    [
      "Stay dates",
      // "-" not "→": pdf-lib's standard 14 fonts only support WinAnsi
      // encoding, which has no arrow glyph — drawText throws on it.
      `${format(parseISO(data.checkIn), "d MMM yyyy")} - ${format(parseISO(data.checkOut), "d MMM yyyy")} (${nights} night${nights === 1 ? "" : "s"})`,
    ],
    ["Payment method", data.paymentMethod ?? "—"],
    ["Payment reference", data.paymentReference ?? "—"],
    ["Date paid", paidDate],
  ];

  for (const [label, value] of rows) {
    drawText(label, { size: 10, color: MUTED });
    drawText(value, { x: marginX + 160, size: 11 });
    y -= 22;
  }

  y -= 14;
  page.drawLine({
    start: { x: marginX, y },
    end: { x: width - marginX, y },
    thickness: 1,
    color: rgb(0.85, 0.8, 0.72),
  });
  y -= 30;

  drawText("Total confirmed for your stay", { size: 12, f: bold });
  drawText(formatMoney(data.totalAmount, data.currency), {
    x: width - marginX - 120,
    size: 16,
    f: bold,
    color: TERRACOTTA,
  });
  y -= 50;

  drawText("Thank you for staying with us.", { size: 10, color: MUTED });

  return doc.save();
}
