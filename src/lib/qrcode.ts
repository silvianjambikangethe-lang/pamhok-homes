import "server-only";
import QRCode from "qrcode";

export async function generateQrDataUrl(url: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(url, { margin: 1, width: 240 });
  } catch {
    return null;
  }
}
