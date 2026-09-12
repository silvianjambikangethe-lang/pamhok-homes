import "server-only";
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
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

// Design adapted from a ticket-style template the owner supplied
// (pamhok-receipt-template.html) — same palette/typography/card shape,
// rewritten for a stay payment rather than the template's original
// "non-refundable property deposit" copy, and using next/og's flexbox
// subset instead of the template's CSS grid + multi-layer box-shadow
// (ImageResponse/Satori only renders flexbox reliably — see
// node_modules/next/dist/docs/.../image-response.md). The scalloped
// ticket-perforation edges (a tiled radial-gradient background) don't
// survive that same flexbox-only constraint, so a dashed rule stands in
// for them instead of trying to replicate a tiled background pattern
// Satori doesn't support.
const COLORS = {
  bg: "#f5ead8",
  text: "#201e1d",
  neutral100: "#f9f4ed",
  neutral700: "#645c50",
  accent100: "#fff2eb",
  accent200: "#ffe1d0",
  accent300: "#ffc6a5",
  accent700: "#8c491a",
  accent800: "#643312",
};

let fontsPromise: Promise<{ name: string; data: Buffer; weight: 400 | 700; style: "normal" }[]> | null = null;
function loadFonts() {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      readFile(join(process.cwd(), "assets/fonts/Caprasimo-Regular.ttf")),
      readFile(join(process.cwd(), "assets/fonts/Figtree-Regular.ttf")),
      readFile(join(process.cwd(), "assets/fonts/Figtree-Bold.ttf")),
    ]).then(([caprasimo, figtreeRegular, figtreeBold]) => [
      { name: "Caprasimo", data: caprasimo, weight: 400 as const, style: "normal" as const },
      { name: "Figtree", data: figtreeRegular, weight: 400 as const, style: "normal" as const },
      { name: "Figtree", data: figtreeBold, weight: 700 as const, style: "normal" as const },
    ]);
  }
  return fontsPromise;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: COLORS.neutral700, fontSize: 14 }}>{label}</span>
      <span style={{ color: COLORS.text, fontWeight: 700, fontSize: 14, textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

export async function generateReceiptImage(data: ReceiptData): Promise<ArrayBuffer> {
  const fonts = await loadFonts();

  const nights = Math.max(
    1,
    differenceInCalendarDays(parseISO(data.checkOut), parseISO(data.checkIn)),
  );
  const dateStr = data.paidAt ? format(parseISO(data.paidAt), "d MMM yyyy") : "—";
  const stayDates = `${format(parseISO(data.checkIn), "d MMM")} - ${format(parseISO(data.checkOut), "d MMM yyyy")} (${nights} night${nights === 1 ? "" : "s"})`;

  const element = (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
        background: COLORS.bg,
        fontFamily: "Figtree",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: 420,
          background: COLORS.neutral100,
          borderRadius: 28,
          border: `2px solid ${COLORS.accent300}`,
          padding: "32px 32px 28px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
          {/* Satori (next/og's renderer) only understands plain <img>,
              not next/image's <Image> — this JSX never touches the real
              DOM, it's fed to ImageResponse to rasterize server-side. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={SITE.logoIconUrl}
            alt=""
            width={56}
            height={56}
            style={{ borderRadius: 999, marginRight: 14 }}
          />
        </div>

        <div style={{ display: "flex", fontFamily: "Caprasimo", color: COLORS.accent800, fontSize: 30 }}>
          {SITE.name}
        </div>
        <div
          style={{
            display: "flex",
            color: COLORS.neutral700,
            fontSize: 13,
            letterSpacing: 1,
            textTransform: "uppercase",
            marginTop: 2,
            marginBottom: 4,
          }}
        >
          Where luxury meets comfort
        </div>

        <div style={{ display: "flex", height: 1, background: COLORS.accent200, margin: "18px 0" }} />

        <div style={{ display: "flex", color: COLORS.accent700, fontWeight: 700, fontSize: 13, letterSpacing: 1, textTransform: "uppercase" }}>
          Payment Receipt
        </div>
        <div style={{ display: "flex", color: COLORS.neutral700, fontSize: 14, marginTop: 4 }}>
          Receipt No. {data.bookingReference ?? "—"} · {dateStr}
        </div>

        <div style={{ display: "flex", height: 1, background: COLORS.accent200, margin: "18px 0" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          <Row label="Room" value={data.roomName} />
          <Row label="Guest" value={data.guestName} />
          <Row label="Stay dates" value={stayDates} />
          <Row label="Payment method" value={data.paymentMethod ?? "—"} />
          <Row label="Payment reference" value={data.paymentReference ?? "—"} />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            background: COLORS.accent100,
            borderRadius: 16,
            padding: "16px 20px",
            marginBottom: 14,
          }}
        >
          <span style={{ color: COLORS.accent800, fontWeight: 700, fontSize: 14 }}>Total paid</span>
          <span style={{ fontFamily: "Caprasimo", color: COLORS.accent800, fontSize: 28 }}>
            {formatMoney(data.totalAmount, data.currency)}
          </span>
        </div>

        <div style={{ display: "flex", height: 1, borderTop: `1px dashed ${COLORS.accent300}`, marginBottom: 16 }} />

        <div style={{ display: "flex", justifyContent: "center", color: COLORS.accent700, fontSize: 14 }}>
          Thank you for staying with us.
        </div>
      </div>
    </div>
  );

  const response = new ImageResponse(element, { width: 600, height: 720, fonts });
  return response.arrayBuffer();
}
