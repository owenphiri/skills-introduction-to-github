'use strict';
/**
 * Generate PWA app icons with zero dependencies (Node zlib only).
 * Draws a simple SafeGirl mark: green rounded background + white graduation
 * cap silhouette. Run: node scripts/genicons.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 (PNG chunks require it).
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function png(size, draw) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
  };
  draw(set, size);
  // Add filter byte (0) at the start of each scanline.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// Drawing: green rounded square + white mortarboard (diamond) + tassel.
function drawIcon(set, S) {
  const radius = S * 0.18;
  const inRound = (x, y) => {
    const cx = Math.min(Math.max(x, radius), S - radius);
    const cy = Math.min(Math.max(y, radius), S - radius);
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2 || (x >= radius && x <= S - radius) || (y >= radius && y <= S - radius);
  };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (inRound(x, y)) set(x, y, 20, 92, 51);      // var(--green-dark)
  }
  // Mortarboard: a white diamond centred slightly above middle.
  const cx = S / 2, cy = S * 0.44, half = S * 0.26;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (Math.abs(x - cx) / half + Math.abs(y - cy) / (half * 0.55) <= 1) set(x, y, 255, 255, 255);
  }
  // Cap base (trapezoid) below the board.
  for (let y = Math.round(cy); y < cy + half * 0.7; y++) {
    const w = half * 0.55 * (1 - (y - cy) / (half * 1.3));
    for (let x = Math.round(cx - w); x <= cx + w; x++) set(x, y, 255, 255, 255);
  }
  // Tassel.
  for (let y = Math.round(cy); y < S * 0.7; y++) set(Math.round(cx + half * 0.85), y, 230, 167, 0);
}

const outDir = path.join(__dirname, '..', 'public', 'assets');
fs.mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), png(size, drawIcon));
  console.log(`wrote icon-${size}.png`);
}
