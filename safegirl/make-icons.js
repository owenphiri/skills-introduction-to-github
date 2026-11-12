'use strict';
/* Zero-dependency PNG icon generator for SafeGirl EduTrack PWA.
   Green rounded tile with a white graduation cap + a small heart (protection). */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0); const t = Buffer.from(type, 'ascii'); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0); return Buffer.concat([len, t, data, crc]); };

function png(size, draw) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, r, g, b, a = 255) => { if (x < 0 || y < 0 || x >= size || y >= size) return; const i = (y * size + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a; };
  draw(set, size);
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function makeDraw(maskable) {
  return (set, S) => {
    const pad = maskable ? 0 : 0;
    const r = maskable ? 0 : S * 0.2;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const cx = Math.min(Math.max(x, r), S - r), cy = Math.min(Math.max(y, r), S - r);
      const inRound = maskable || (x - cx) ** 2 + (y - cy) ** 2 <= r * r || (x >= r && x <= S - r) || (y >= r && y <= S - r);
      if (inRound) { const t = (x + y) / (2 * S); set(x, y, Math.round(15 + t * 10), Math.round(76 + t * 30), Math.round(53 + t * 20)); }
    }
    // graduation cap: diamond board
    const ccx = S / 2, ccy = S * 0.42, half = S * 0.24;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (Math.abs(x - ccx) / half + Math.abs(y - ccy) / (half * 0.5) <= 1) set(x, y, 255, 255, 255);
    }
    // cap base trapezoid
    for (let y = Math.round(ccy); y < ccy + half * 0.65; y++) {
      const w = half * 0.5 * (1 - (y - ccy) / (half * 1.2));
      for (let x = Math.round(ccx - w); x <= ccx + w; x++) set(x, y, 255, 255, 255);
    }
    // tassel
    for (let y = Math.round(ccy); y < S * 0.62; y++) set(Math.round(ccx + half * 0.8), y, 245, 200, 60);
    // heart (protection) lower center — gold
    const hy = S * 0.72, hs = S * 0.08;
    for (let y = -hs; y <= hs; y++) for (let x = -hs; x <= hs; x++) {
      const nx = x / hs, ny = y / hs;
      const inHeart = Math.pow(nx * nx + ny * ny - 1, 3) - nx * nx * ny * ny * ny <= 0;
      if (inHeart) set(Math.round(ccx + x), Math.round(hy - y), 245, 200, 60);
    }
  };
}

const out = path.join(__dirname, 'assets');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon-192.png'), png(192, makeDraw(false)));
fs.writeFileSync(path.join(out, 'icon-512.png'), png(512, makeDraw(false)));
fs.writeFileSync(path.join(out, 'icon-maskable-512.png'), png(512, makeDraw(true)));
console.log('icons written to', out);
