'use strict';
/* Generate PrimeAxis PWA icons (zero-dependency PNG via zlib): purple bg + egg. */
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

function draw(set, S) {
  const r = S * 0.2;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const cx = Math.min(Math.max(x, r), S - r), cy = Math.min(Math.max(y, r), S - r);
    const inRound = (x - cx) ** 2 + (y - cy) ** 2 <= r * r || (x >= r && x <= S - r) || (y >= r && y <= S - r);
    if (inRound) {
      // diagonal violet gradient
      const t = (x + y) / (2 * S);
      set(x, y, Math.round(91 - t * 30), Math.round(33 + t * 10), Math.round(182 - t * 40));
    }
  }
  // white egg (ellipse), slightly tall
  const ex = S / 2, ey = S * 0.52, rx = S * 0.22, ry = S * 0.28;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (((x - ex) / rx) ** 2 + ((y - ey) / ry) ** 2 <= 1) set(x, y, 255, 255, 255);
  }
  // gold yolk dot
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if ((x - ex) ** 2 + (y - ey) ** 2 <= (S * 0.07) ** 2) set(x, y, 245, 158, 11);
  }
}

const out = path.join(__dirname, '..', 'public', 'assets');
fs.mkdirSync(out, { recursive: true });
for (const s of [192, 512]) { fs.writeFileSync(path.join(out, `icon-${s}.png`), png(s, draw)); console.log('wrote icon-' + s + '.png'); }
