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
  // Brown-tinted beige behind "Total paid" — was accent100 (a pale pink),
  // swapped for something that reads as part of the same warm-brown
  // palette instead of a different hue entirely.
  totalBg: "#ece0c6",
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

// The receipt uses its own bundled logo file (assets/branding/receipt-logo.png)
// rather than SITE.logoIconUrl — a higher-detail circular mark (gold key +
// house line art) the owner supplied specifically for this receipt, fetched
// as a data URI the same way fonts are loaded from disk rather than over
// the network, so generating a receipt never depends on Supabase storage
// being reachable.
let logoDataUriPromise: Promise<string> | null = null;
function loadLogoDataUri() {
  if (!logoDataUriPromise) {
    logoDataUriPromise = readFile(join(process.cwd(), "assets/branding/receipt-logo.png")).then(
      (buf) => `data:image/png;base64,${buf.toString("base64")}`,
    );
  }
  return logoDataUriPromise;
}

// Rendered at 3.5x the original 600x720 design so the downloaded/emailed
// image stays crisp when a guest zooms in or prints it, and reads as a
// visibly bigger image (more raw pixels) when opened directly — every
// pixel value below is the original design's value times SCALE, not a
// separate set of numbers, so the layout proportions are unchanged.
const SCALE = 3.5;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 * SCALE }}>
      <span style={{ color: COLORS.neutral700, fontSize: 14 * SCALE }}>{label}</span>
      <span
        style={{
          color: COLORS.text,
          fontWeight: 700,
          fontSize: 14 * SCALE,
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export async function generateReceiptImage(data: ReceiptData): Promise<ArrayBuffer> {
  const [fonts, logoDataUri] = await Promise.all([loadFonts(), loadLogoDataUri()]);

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
          width: 420 * SCALE,
          background: COLORS.neutral100,
          borderRadius: 28 * SCALE,
          border: `${2 * SCALE}px solid ${COLORS.accent300}`,
          padding: `${32 * SCALE}px ${32 * SCALE}px ${28 * SCALE}px`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20 * SCALE,
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: "Caprasimo",
              color: COLORS.accent800,
              fontSize: 30 * SCALE,
            }}
          >
            {SITE.name}
          </div>

          {/* Satori (next/og's renderer) only understands plain <img>,
              not next/image's <Image> — this JSX never touches the real
              DOM, it's fed to ImageResponse to rasterize server-side. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoDataUri}
            alt=""
            width={110 * SCALE}
            height={110 * SCALE}
            style={{ borderRadius: 999, marginLeft: 14 * SCALE, flexShrink: 0 }}
          />
        </div>

        <div
          style={{
            display: "flex",
            height: 1,
            background: COLORS.accent200,
            margin: `${18 * SCALE}px 0`,
          }}
        />

        <div
          style={{
            display: "flex",
            color: COLORS.accent700,
            fontWeight: 700,
            fontSize: 13 * SCALE,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          Payment Receipt
        </div>
        <div
          style={{
            display: "flex",
            color: COLORS.neutral700,
            fontSize: 14 * SCALE,
            marginTop: 4 * SCALE,
          }}
        >
          Receipt No. {data.bookingReference ?? "—"} · {dateStr}
        </div>

        <div
          style={{
            display: "flex",
            height: 2.5 * SCALE,
            background: COLORS.accent700,
            margin: `${18 * SCALE}px 0`,
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10 * SCALE,
            marginBottom: 20 * SCALE,
          }}
        >
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
            background: COLORS.totalBg,
            borderRadius: 16 * SCALE,
            padding: `${16 * SCALE}px ${20 * SCALE}px`,
            marginBottom: 14 * SCALE,
          }}
        >
          <span style={{ color: COLORS.accent800, fontWeight: 700, fontSize: 14 * SCALE }}>
            Total paid
          </span>
          <span style={{ fontFamily: "Caprasimo", color: COLORS.accent800, fontSize: 28 * SCALE }}>
            {formatMoney(data.totalAmount, data.currency)}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            height: 1,
            borderTop: `${2.5 * SCALE}px dashed ${COLORS.accent700}`,
            marginBottom: 16 * SCALE,
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            color: COLORS.accent700,
            fontSize: 14 * SCALE,
          }}>
          Thank you for staying with us.
        </div>
      </div>
    </div>
  );

  const response = new ImageResponse(element, {
    width: 600 * SCALE,
    height: 720 * SCALE,
    fonts,
  });
  return response.arrayBuffer();
}
