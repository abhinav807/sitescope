/**
 * Generates original SiteScope icons (charcoal rounded square + lime "S").
 * No external deps: writes minimal truecolor PNGs via zlib.
 * Sizes: 16, 32, 48, 128 -> public/icons/
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../public/icons');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([td, data])));
  return Buffer.concat([len, td, data, crc]);
}

function writePng(size, path) {
  const bg = { r: 0x12, g: 0x14, b: 0x12 };
  const lime = { r: 0xc8, g: 0xf0, b: 0x4a };
  const dark = { r: 0x1a, g: 0x20, b: 0x05 };
  // Rounded-rect mask
  const radius = Math.floor(size * 0.22);
  const rows = [];
  const cx = size / 2;
  // Simple "S" bitmap via distance to a stylized S path: use block font 5x7 scaled.
  const S = [
    '01110',
    '10001',
    '10000',
    '01110',
    '00001',
    '10001',
    '01110',
  ];
  const scale = Math.max(1, Math.floor(size / 16));
  const sw = 5 * scale;
  const sh = 7 * scale;
  const ox = Math.floor(cx - sw / 2);
  const oy = Math.floor(size / 2 - sh / 2);
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    row[0] = 0; // filter none
    for (let x = 0; x < size; x++) {
      // rounded corners -> transparent-ish (use bg blended to dark? PNG without alpha: just bg)
      const inCorner =
        (x < radius && y < radius && (x - radius) ** 2 + (y - radius) ** 2 > radius ** 2) ||
        (x >= size - radius && y < radius && (x - (size - radius)) ** 2 + (y - radius) ** 2 > radius ** 2) ||
        (x < radius && y >= size - radius && (x - radius) ** 2 + (y - (size - radius)) ** 2 > radius ** 2) ||
        (x >= size - radius && y >= size - radius && (x - (size - radius)) ** 2 + (y - (size - radius)) ** 2 > radius ** 2);
      let px = inCorner ? { r: 12, g: 14, b: 12 } : bg;
      // lime pill behind S for larger sizes
      const pillR = size * 0.30;
      const dx = x - cx;
      const dy = y - size / 2;
      if (!inCorner && dx * dx + dy * dy < pillR * pillR && size >= 32) {
        px = lime;
      }
      // S glyph
      const gx = Math.floor((x - ox) / scale);
      const gy = Math.floor((y - oy) / scale);
      if (gx >= 0 && gx < 5 && gy >= 0 && gy < 7 && S[gy][gx] === '1') {
        px = size >= 32 ? dark : lime;
      }
      // subtle border
      if (!inCorner && (x === 0 || y === 0 || x === size - 1 || y === size - 1)) {
        px = { r: 0x2a, g: 0x30, b: 0x2a };
      }
      row[1 + x * 3] = px.r;
      row[1 + x * 3 + 1] = px.g;
      row[1 + x * 3 + 2] = px.b;
    }
    rows.push(row);
  }
  const raw = Buffer.concat(rows);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
  console.log(`icon ${size}x${size} -> ${path} (${png.length} bytes)`);
}

mkdirSync(OUT, { recursive: true });
for (const s of [16, 32, 48, 128]) {
  writePng(s, resolve(OUT, `icon-${s}.png`));
}
// Original SVG source (for store listing / docs)
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect x="2" y="2" width="124" height="124" rx="28" fill="#121412" stroke="#2a302a" stroke-width="3"/><circle cx="64" cy="64" r="38" fill="#c8f04a"/><text x="64" y="82" text-anchor="middle" font-family="Arial,sans-serif" font-size="52" font-weight="800" fill="#1a2005">S</text></svg>`;
writeFileSync(resolve(OUT, 'icon.svg'), svg);
console.log('icon.svg written');
