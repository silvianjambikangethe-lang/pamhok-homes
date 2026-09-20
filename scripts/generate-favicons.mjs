// Generates the Pamhok Homes favicon files into an app folder.
// Usage: node scripts/generate-favicons.mjs app   (or src/app)
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const outDir = process.argv[2] || "app";
mkdirSync(outDir, { recursive: true });

const BROWN = "#5A3825";
const CREAM = "#F6EFE4";
const OUTLINE = "M25 52 H11.5 V25 L32 9 L52.5 25 V31";
const KEY =
  "M23 22.5 H34 A10 10 0 0 1 34 42.5 H27.4 V45.2 H33.2 V48 H30.2 V50.6 H33.2 V53.4 H27.4 V55.2 L26.4 56.2 H24 L23 55.2 Z M27.4 26.3 H34 A6.2 6.2 0 0 1 34 38.7 H27.4 Z";
const KEY_SMALL =
  "M22.5 22 H34 A10.5 10.5 0 0 1 34 43 H28.2 V46 H35 V49.5 H31.5 V52.5 H35 V56 H28.2 V57 H22.5 Z M28.2 27 H34 A5.5 5.5 0 0 1 34 38 H28.2 Z";

function svg({ small = false, square = false, size = null } = {}) {
  const wh = size ? ` width="${size}" height="${size}"` : "";
  const rx = square ? "" : ' rx="14"';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"${wh}>
  <rect width="64" height="64"${rx} fill="${CREAM}"/>
  <path d="${OUTLINE}" fill="none" stroke="${BROWN}" stroke-width="${small ? 4.2 : 2.6}" stroke-linecap="round" stroke-linejoin="round"/>
  <path fill="${BROWN}" stroke="${BROWN}" stroke-width="${small ? 0.4 : 0.6}" stroke-linejoin="round" fill-rule="evenodd" d="${small ? KEY_SMALL : KEY}"/>
</svg>
`;
}

const png = (opts, size) => sharp(Buffer.from(svg({ ...opts, size }))).png().toBuffer();

// 1. icon.svg (main version, scalable)
writeFileSync(path.join(outDir, "icon.svg"), svg());

// 2. apple-icon.png (180 x 180, square corners, phones round them)
writeFileSync(path.join(outDir, "apple-icon.png"), await png({ square: true }, 180));

// 3. favicon.ico with 16, 32 and 48 pixel images (16 and 32 use the sturdier drawing)
const parts = [
  [16, await png({ small: true }, 16)],
  [32, await png({ small: true }, 32)],
  [48, await png({ small: false }, 48)],
];
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(parts.length, 4);
let offset = 6 + 16 * parts.length;
const entries = [];
for (const [size, data] of parts) {
  const e = Buffer.alloc(16);
  e.writeUInt8(size, 0);
  e.writeUInt8(size, 1);
  e.writeUInt8(0, 2);
  e.writeUInt8(0, 3);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(data.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += data.length;
  entries.push(e);
}
writeFileSync(path.join(outDir, "favicon.ico"), Buffer.concat([header, ...entries, ...parts.map((p) => p[1])]));

console.log("Wrote icon.svg, apple-icon.png and favicon.ico to", outDir);
