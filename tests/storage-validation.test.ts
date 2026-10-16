import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/types';
import {
  appendHistory,
  clearHistory,
  loadHistory,
  loadSettings,
  sanitizeHistory,
  sanitizeSettings,
} from '../src/lib/settings';
import { storageSet } from '../src/lib/browser/api';

/** Risk 3 regression tests: persisted storage is validated, never trusted. */

describe('sanitizeSettings', () => {
  it('returns defaults for missing/empty payloads', () => {
    expect(sanitizeSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('junk')).toEqual(DEFAULT_SETTINGS);
  });

  it('preserves valid user data and drops unknown fields', () => {
    const next = sanitizeSettings({ ...DEFAULT_SETTINGS, theme: 'light', titleMin: 40, extra: 1 });
    expect(next.theme).toBe('light');
    expect(next.titleMin).toBe(40);
    expect(next).toEqual({ ...DEFAULT_SETTINGS, theme: 'light', titleMin: 40 });
  });

  it('falls back on wrong types and bad enums', () => {
    const s = sanitizeSettings({ titleMin: 'abc', titleMax: NaN, theme: 'neon', density: 3, defaultTab: '', exportIncludeQuery: 'yes', historyEnabled: 1, historyLimit: Infinity });
    expect(s.titleMin).toBe(DEFAULT_SETTINGS.titleMin);
    expect(s.titleMax).toBe(DEFAULT_SETTINGS.titleMax);
    expect(s.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(s.density).toBe(DEFAULT_SETTINGS.density);
    expect(s.defaultTab).toBe(DEFAULT_SETTINGS.defaultTab);
    expect(s.exportIncludeQuery).toBe(false);
    expect(s.historyEnabled).toBe(false);
    expect(s.historyLimit).toBe(DEFAULT_SETTINGS.historyLimit);
  });

  it('clamps out-of-range numbers to documented bounds', () => {
    expect(sanitizeSettings({ titleMin: 0 }).titleMin).toBe(1);
    expect(sanitizeSettings({ historyLimit: 99 }).historyLimit).toBe(50);
    expect(sanitizeSettings({ historyLimit: -5 }).historyLimit).toBe(1);
    expect(sanitizeSettings({ largeImageMinWidth: 99999 }).largeImageMinWidth).toBe(4000);
  });

  it('resets inverted min/max pairs to defaults', () => {
    const s = sanitizeSettings({ titleMin: 80, titleMax: 20 });
    expect(s.titleMin).toBe(DEFAULT_SETTINGS.titleMin);
    expect(s.titleMax).toBe(DEFAULT_SETTINGS.titleMax);
  });

  it('accepts boundary values', () => {
    expect(sanitizeSettings({ historyLimit: 1 }).historyLimit).toBe(1);
    expect(sanitizeSettings({ historyLimit: 50 }).historyLimit).toBe(50);
    expect(sanitizeSettings({ defaultTab: 'a'.repeat(32) }).defaultTab).toHaveLength(32);
    expect(sanitizeSettings({ defaultTab: 'a'.repeat(33) }).defaultTab).toBe(DEFAULT_SETTINGS.defaultTab);
  });
});

describe('sanitizeHistory', () => {
  const good = (i: number) => ({ url: `https://x/${i}`, title: `t${i}`, analyzedAt: '2026-01-01', critical: i, warning: 0 });

  it('returns [] for non-arrays and skips junk entries', () => {
    expect(sanitizeHistory(null)).toEqual([]);
    expect(sanitizeHistory({})).toEqual([]);
    expect(sanitizeHistory([null, 42, 'x', { url: 1 }, good(1)])).toEqual([
      { url: 'https://x/1', title: 't1', analyzedAt: '2026-01-01', critical: 1, warning: 0 },
    ]);
  });

  it('floors counts and caps length at 50', () => {
    const rows = sanitizeHistory([{ ...good(1), critical: -3 }, ...Array.from({ length: 60 }, (_, i) => good(i))]);
    expect(rows).toHaveLength(50);
    expect(rows[0].critical).toBe(0);
  });
});

describe('loadSettings/loadHistory over the real store', () => {
  it('sanitizes corrupt persisted payloads end to end', async () => {
    await storageSet('sitescope:settings:v1', { theme: 'hacker', titleMin: -10, historyLimit: 500, historyEnabled: 'yes' });
    const s = await loadSettings();
    expect(s.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(s.titleMin).toBe(1);
    expect(s.historyLimit).toBe(50);
    expect(s.historyEnabled).toBe(false);
    await storageSet('sitescope:history:v1', [{ nope: true }, null]);
    expect(await loadHistory()).toEqual([]);
  });

  it('round-trips valid settings and history', async () => {
    await clearHistory();
    await storageSet('sitescope:settings:v1', { ...DEFAULT_SETTINGS, density: 'comfortable' });
    expect((await loadSettings()).density).toBe('comfortable');
    await appendHistory({ url: 'https://x/', title: 't', analyzedAt: 'now', critical: 2, warning: 1 }, 10);
    expect(await loadHistory()).toHaveLength(1);
    await clearHistory();
  });
});
