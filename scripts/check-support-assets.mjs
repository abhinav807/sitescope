/**
 * Verifies the owner-supplied support assets (UPI QR image).
 *
 * - Presence: public/support/upi-qr.png must exist for a release build.
 * - Integrity: must be a real PNG (magic bytes) within sane size bounds, and —
 *   once public/support/upi-qr.sha256 is recorded from the owner-supplied file —
 *   must match that hash byte-for-byte (never recolored, cropped, or regenerated).
 * - Per-build: every dist/<browser> must contain an identical copy.
 *
 * Exit codes: 0 = verified, 1 = corrupt/mismatch (must fail packaging),
 * 2 = missing (blocks release packaging; dev builds continue with a warning).
 *
 * Usage: node scripts/check-support-assets.mjs [--all | --browser=X] [--dist]
 *   --dist also checks the built copies (run after build).
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TARGETS = ['chrome', 'firefox', 'edge', 'opera', 'brave'];
const SRC = 'public/support/upi-qr.png';
const HASH_FILE = 'public/support/upi-qr.sha256';

const args = process.argv.slice(2);
const checkDist = args.includes('--dist');
const list = args.includes('--all')
  ? TARGETS
  : [args.find((a) => a.startsWith('--browser='))?.split('=')[1] ?? 'chrome'];

const srcPath = resolve(ROOT, SRC);
if (!existsSync(srcPath)) {
  console.log(`[support-assets] MISSING ${SRC} — owner-supplied UPI QR not yet in the repo (exit 2).`);
  process.exit(2);
}
const buf = readFileSync(srcPath);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
if (!buf.subarray(0, 8).equals(PNG_MAGIC)) {
  console.error(`[support-assets] FAIL ${SRC} is not a PNG file.`);
  process.exit(1);
}
if (buf.length < 1024 || buf.length > 5 * 1024 * 1024) {
  console.error(`[support-assets] FAIL ${SRC} has implausible size (${buf.length} bytes).`);
  process.exit(1);
}
const sha = createHash('sha256').update(buf).digest('hex');
const hashPath = resolve(ROOT, HASH_FILE);
if (existsSync(hashPath)) {
  const expected = readFileSync(hashPath, 'utf-8').trim().toLowerCase();
  if (expected !== sha) {
    console.error(`[support-assets] FAIL hash mismatch for ${SRC} (expected ${expected}, got ${sha}).`);
    process.exit(1);
  }
  console.log(`[support-assets] OK ${SRC} (${buf.length} bytes, sha256 matches recorded value).`);
} else {
  console.log(`[support-assets] OK ${SRC} (${buf.length} bytes, sha256:${sha}).`);
  console.log(`[support-assets] NOTE no ${HASH_FILE} recorded yet — record it once the owner file lands to pin it.`);
}

if (checkDist) {
  let bad = 0;
  for (const t of list) {
    if (!TARGETS.includes(t)) throw new Error(`Unknown browser: ${t}`);
    const p = resolve(ROOT, `dist/${t}/support/upi-qr.png`);
    if (!existsSync(p)) {
      console.error(`[support-assets] FAIL dist/${t}/support/upi-qr.png missing.`);
      bad++;
      continue;
    }
    const h = createHash('sha256').update(readFileSync(p)).digest('hex');
    if (h !== sha) {
      console.error(`[support-assets] FAIL dist/${t} copy differs from source.`);
      bad++;
    }
  }
  if (bad) process.exit(1);
  console.log(`[support-assets] OK identical QR copies in dist for: ${list.join(', ')}.`);
}
