/** Settings store: chrome.storage.local with memory fallback. Local-only, never synced. */
import type { ExtensionSettings } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { storageGet, storageRemove, storageSet } from './browser/api';

const KEY = 'sitescope:settings:v1';
const HISTORY_KEY = 'sitescope:history:v1';

export async function loadSettings(): Promise<ExtensionSettings> {
  const raw = await storageGet<Partial<ExtensionSettings>>(KEY, {});
  return { ...DEFAULT_SETTINGS, ...raw };
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
  return storageGet<HistoryEntry[]>(HISTORY_KEY, []);
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
