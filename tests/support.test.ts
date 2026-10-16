/**
 * Copyright © 2026 Abhinav Goyal and GoldenHour Delhi. All rights reserved.
 */
import { describe, it, expect } from 'vitest';
import source from '../src/lib/support.ts?raw';
import {
  ATTRIBUTION_SHORT,
  COPYRIGHT_LINE,
  CREATOR,
  ORGANIZATION,
  PRODUCT_NAME,
  QR_ASSET_PATH,
  SUPPORT_CONTACTS,
  isPlausibleEmail,
  qrImageUrl,
} from '../src/lib/support';

describe('product identity constants', () => {
  it('names the product, creator, and organization without trademark symbols', () => {
    expect(PRODUCT_NAME).toBe('SiteScope');
    expect(CREATOR).toBe('Abhinav Goyal');
    expect(ORGANIZATION).toBe('GoldenHour Delhi');
    expect(ATTRIBUTION_SHORT).toContain('Abhinav Goyal');
    expect(ATTRIBUTION_SHORT).toContain('GoldenHour Delhi');
    expect(COPYRIGHT_LINE).toContain('© 2026');
    for (const s of [ATTRIBUTION_SHORT, COPYRIGHT_LINE, PRODUCT_NAME]) {
      expect(s).not.toMatch(/[®™]/);
      expect(s.toLowerCase()).not.toContain('registered');
    }
  });

  it('lists exactly the verified support contacts', () => {
    expect(SUPPORT_CONTACTS.map((c) => c.email)).toEqual([
      'hello@goldenhourdelhi.co.in',
      'abhinavgoyal300@gmail.com',
    ]);
    for (const c of SUPPORT_CONTACTS) expect(isPlausibleEmail(c.email)).toBe(true);
    expect(isPlausibleEmail('not-an-email')).toBe(false);
  });

  it('resolves the QR asset inside and outside extension contexts', () => {
    // No chrome/browser namespace here (vitest) → relative fallback.
    expect(qrImageUrl()).toBe(`../${QR_ASSET_PATH}`);
    expect(QR_ASSET_PATH).toBe('support/upi-qr.png');
  });

  it('invents no payment identifiers', () => {
    // The owner supplies the QR image; the code must never contain a payment link.
    expect(source).not.toMatch(/upi:\/\//i);
    expect(source).not.toMatch(/payto:/i);
    expect(source).not.toContain('SUPPORT THE PROJECT WITH A FAKE');
  });
});
