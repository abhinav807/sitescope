/**
 * Copyright © 2026 Abhinav Goyal and GoldenHour Delhi. All rights reserved.
 *
 * Shared product-identity constants for SiteScope. Contact addresses below are
 * the verified project contacts — never invent or substitute alternatives.
 * No payment identifiers live here: the UPI QR is a locally bundled image
 * supplied by the owner (see public/support/), and no payment link is generated.
 */

export const PRODUCT_NAME = 'SiteScope';
export const CREATOR = 'Abhinav Goyal';
export const ORGANIZATION = 'GoldenHour Delhi';

/** Short UI attribution (footer lines, About sections). */
export const ATTRIBUTION_SHORT = 'Made and designed by Abhinav Goyal and GoldenHour Delhi.';

/** Full copyright line (About sections, documentation). */
export const COPYRIGHT_LINE = 'Copyright © 2026 Abhinav Goyal and GoldenHour Delhi. All rights reserved.';

export interface SupportContact {
  label: string;
  email: string;
}

/** Verified project contacts. Support mail first, maintainer second. */
export const SUPPORT_CONTACTS: SupportContact[] = [
  { label: 'Support', email: 'hello@goldenhourdelhi.co.in' },
  { label: 'Maintainer', email: 'abhinavgoyal300@gmail.com' },
];

/** Path of the owner-supplied UPI QR image, relative to the extension root. */
export const QR_ASSET_PATH = 'support/upi-qr.png';

export const QR_ALT_TEXT =
  'UPI QR code for voluntarily supporting SiteScope development. Scan it with any UPI payment app to contribute.';

/**
 * Resolves the QR image URL inside extension pages, falling back to a relative
 * path so panels also render in tests and non-extension previews (where the
 * image simply 404s and the UI shows its honest fallback state).
 */
export function qrImageUrl(): string {
  try {
    const g = globalThis as Record<string, unknown>;
    const api = (g.browser ?? g.chrome) as
      | { runtime?: { getURL?: (p: string) => string } }
      | undefined;
    if (typeof api?.runtime?.getURL === 'function') return api.runtime.getURL(QR_ASSET_PATH);
  } catch {
    /* fall through to relative path */
  }
  return `../${QR_ASSET_PATH}`;
}

/** Very small email sanity check used by tests (not a full RFC validator). */
export function isPlausibleEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}
