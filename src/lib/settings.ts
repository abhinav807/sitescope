/** Settings store: chrome.storage.local with memory fallback. Local-only, never synced. */
import type { ExtensionSettings } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { storageGet, storageRemove, storageSet } from './browser/api';

const KEY = 'sitescope:settings:v1';
const HISTORY_KEY = 'sitescope:history:v1';

export async function loadSettings(): Promise<ExtensionSettings> {
  const raw = await storageGet<Partial<ExtensionSettings>>(KEY, {});
  return sanitizeSettings(raw);
}

export async function saveSettings(s: ExtensionSettings): Promise<void> {
  await storageSet(KEY, s);
}

export async function resetSettings(): Promise<ExtensionSettings> {
  await storageRemove(KEY);
  return { ...DEFAULT_SETTINGS };
}

export interface HistoryEntry {
  url: string;
  title: string;
  analyzedAt: string;
  critical: number;
  warning: number;
}

export async function loadHistory(): Promise<HistoryEntry[]> {
  const raw = await storageGet<unknown>(HISTORY_KEY, []);
  return sanitizeHistory(raw);
}

export async function appendHistory(entry: HistoryEntry, limit: number): Promise<HistoryEntry[]> {
  const cur = await loadHistory();
  const next = [entry, ...cur].slice(0, Math.max(1, Math.min(50, limit)));
  await storageSet(HISTORY_KEY, next);
  return next;
}

export async function clearHistory(): Promise<void> {
  await storageRemove(HISTORY_KEY);
}

/**
 * Runtime validation for persisted settings. Browser storage is local-only but
 * NOT trusted: values may be missing (fresh install), outdated (older schema),
 * corrupt, or written by a previous buggy version. Every field is checked and
 * invalid values fall back to DEFAULT_SETTINGS; valid user data passes through
 * untouched and unknown extra fields are dropped (forward-compatible).
 */
function finiteNumber(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = finiteNumber(v, fallback);
  return Math.max(min, Math.min(max, Math.round(n)));
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

export function sanitizeSettings(raw: unknown): ExtensionSettings {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const titleMin = clampInt(o.titleMin, 1, 200, DEFAULT_SETTINGS.titleMin);
  const titleMax = clampInt(o.titleMax, 1, 300, DEFAULT_SETTINGS.titleMax);
  const descriptionMin = clampInt(o.descriptionMin, 1, 500, DEFAULT_SETTINGS.descriptionMin);
  const descriptionMax = clampInt(o.descriptionMax, 1, 1000, DEFAULT_SETTINGS.descriptionMax);
  // Inverted ranges are unusable — reset the pair rather than guessing.
  const titlesOk = titleMin <= titleMax;
  const descsOk = descriptionMin <= descriptionMax;
  return {
    titleMin: titlesOk ? titleMin : DEFAULT_SETTINGS.titleMin,
    titleMax: titlesOk ? titleMax : DEFAULT_SETTINGS.titleMax,
    descriptionMin: descsOk ? descriptionMin : DEFAULT_SETTINGS.descriptionMin,
    descriptionMax: descsOk ? descriptionMax : DEFAULT_SETTINGS.descriptionMax,
    largeImageMinWidth: clampInt(o.largeImageMinWidth, 50, 4000, DEFAULT_SETTINGS.largeImageMinWidth),
    theme: oneOf(o.theme, ['dark', 'light', 'system'] as const, DEFAULT_SETTINGS.theme),
    density: oneOf(o.density, ['compact', 'comfortable'] as const, DEFAULT_SETTINGS.density),
    defaultTab: typeof o.defaultTab === 'string' && o.defaultTab.length > 0 && o.defaultTab.length <= 32
      ? o.defaultTab
      : DEFAULT_SETTINGS.defaultTab,
    exportIncludeQuery: o.exportIncludeQuery === true,
    historyEnabled: o.historyEnabled === true,
    historyLimit: clampInt(o.historyLimit, 1, 50, DEFAULT_SETTINGS.historyLimit),
  };
}

/**
 * Malformed history entries are skipped (not repaired into misleading rows);
 * missing/non-array payloads yield []. Counts are floored at 0, length capped.
 */
export function sanitizeHistory(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: HistoryEntry[] = [];
  for (const e of raw.slice(0, 50)) {
    if (typeof e !== 'object' || e === null) continue;
    const o = e as Record<string, unknown>;
    if (typeof o.url !== 'string' || typeof o.title !== 'string' || typeof o.analyzedAt !== 'string') continue;
    const critical = finiteNumber(o.critical, NaN);
    const warning = finiteNumber(o.warning, NaN);
    if (!Number.isFinite(critical) || !Number.isFinite(warning)) continue;
    out.push({
      url: o.url.slice(0, 2000),
      title: o.title.slice(0, 300),
      analyzedAt: o.analyzedAt.slice(0, 100),
      critical: Math.max(0, Math.floor(critical)),
      warning: Math.max(0, Math.floor(warning)),
    });
  }
  return out;
}
