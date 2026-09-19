'use strict';
/**
 * Render the Lelo mark to PNG (PWA icons + favicon fallback) with no
 * dependencies — raw PNG through zlib, the same approach the other projects in
 * this repository use.
 *
 * The mark is defined once here in the same 64-unit space as
 * public/brand/mark.svg. If you change one, change the other.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* ------------------------------------------------------------ PNG ---- */

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
};

function encodePng(size, rgba) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ----------------------------------------------------------- MARK ---- */

const GREEN = [11, 110, 79];    // #0B6E4F
const AMBER = [246, 168, 40];   // #F6A828
const WHITE = [255, 255, 255];

const CX = 32, CY = 42;         // arc + sun centre
const hypot = (a, b) => Math.sqrt(a * a + b * b);

/** Distance to a round-capped arc of radius R spanning [a0,a1] degrees. */
function onArc(u, v, R, width, a0, a1) {
  const half = width / 2;
  const d = hypot(u - CX, v - CY);
  if (v <= CY) {
    const deg = Math.atan2(CY - v, u - CX) * 180 / Math.PI;
    if (deg >= a0 && deg <= a1 && Math.abs(d - R) <= half) return true;
  }
  for (const a of [a0, a1]) {                       // round caps
    const rad = a * Math.PI / 180;
    if (hypot(u - (CX + R * Math.cos(rad)), v - (CY - R * Math.sin(rad))) <= half) return true;
  }
  return false;
}

function onSegment(u, v, x0, x1, y, width) {
  const half = width / 2;
  if (u >= x0 && u <= x1 && Math.abs(v - y) <= half) return true;
  return hypot(u - x0, v - y) <= half || hypot(u - x1, v - y) <= half;
}

function inRoundRect(u, v, r) {
  if (u < 0 || v < 0 || u > 64 || v > 64) return false;
  const cx = Math.min(Math.max(u, r), 64 - r);
  const cy = Math.min(Math.max(v, r), 64 - r);
  return hypot(u - cx, v - cy) <= r || (u >= r && u <= 64 - r) || (v >= r && v <= 64 - r);
}

const blend = (dst, src, a) => [0, 1, 2].map(i => Math.round(dst[i] * (1 - a) + src[i] * a));

/** Colour of the mark at a point in 64-unit space. Returns [r,g,b,a]. */
function colorAt(u, v) {
  if (!inRoundRect(u, v, 14)) return [0, 0, 0, 0];
  let c = GREEN;
  if (onArc(u, v, 25, 3.0, 30, 150)) c = blend(c, WHITE, 0.55);
  if (onArc(u, v, 19, 3.25, 30, 150)) c = blend(c, WHITE, 0.85);
  if (hypot(u - CX, v - CY) <= 12 && v <= CY) c = AMBER;   // rising sun
  if (onSegment(u, v, 16, 48, 46, 3.5)) c = AMBER;        // horizon, clear of the sun
  return [c[0], c[1], c[2], 255];
}

/** Supersample 4x4 per pixel — the arcs are thin and alias badly otherwise. */
function render(size) {
  const px = Buffer.alloc(size * size * 4);
  const N = 4, scale = 64 / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < N; sy++) {
        for (let sx = 0; sx < N; sx++) {
          const [cr, cg, cb, ca] = colorAt((x + (sx + 0.5) / N) * scale, (y + (sy + 0.5) / N) * scale);
          const w = ca / 255;
          r += cr * w; g += cg * w; b += cb * w; a += ca;
        }
      }
      const n = N * N, cov = a / (255 * n);
      const i = (y * size + x) * 4;
      if (cov > 0) {
        px[i] = Math.round(r / (n * cov)); px[i + 1] = Math.round(g / (n * cov));
        px[i + 2] = Math.round(b / (n * cov)); px[i + 3] = Math.round(cov * 255);
      }
    }
  }
  return encodePng(size, px);
}

/**
 * Wrap a PNG in an ICO container. Browsers still request /favicon.ico
 * unprompted, and a 404 on every page load is noise in the logs and a missed
 * icon in the tabs of anything that does not read the SVG link.
 */
function ico(pngBuffer, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);           // reserved
  header.writeUInt16LE(1, 2);           // type: icon
  header.writeUInt16LE(1, 4);           // one image
  const entry = Buffer.alloc(16);
  entry[0] = size === 256 ? 0 : size;   // width  (0 means 256)
  entry[1] = size === 256 ? 0 : size;   // height
  entry[2] = 0;                         // palette size
  entry[3] = 0;                         // reserved
  entry.writeUInt16LE(1, 4);            // colour planes
  entry.writeUInt16LE(32, 6);           // bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12);
  return Buffer.concat([header, entry, pngBuffer]);
}

const out = path.join(__dirname, '..', 'public', 'assets');
fs.mkdirSync(out, { recursive: true });
for (const s of [32, 180, 192, 512, ...(process.argv.includes('--preview') ? [640] : [])]) {
  fs.writeFileSync(path.join(out, `icon-${s}.png`), render(s));
  console.log(`wrote icon-${s}.png`);
}
const fav = render(32);
fs.writeFileSync(path.join(__dirname, '..', 'public', 'favicon.ico'), ico(fav, 32));
console.log('wrote favicon.ico');
