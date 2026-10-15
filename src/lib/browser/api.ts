/**
 * Cross-browser API layer. All browser differences live here.
 * Uses feature detection, never UA sniffing for capability decisions.
 * Supports `chrome.*` (callback + promise) and `browser.*` (Firefox) namespaces.
 */

export type BrowserFamily = 'chromium' | 'firefox' | 'unknown';

export function extensionApi(): typeof chrome | undefined {
  try {
    const g = globalThis as Record<string, unknown>;
    if (g.browser) return g.browser as unknown as typeof chrome;
    if (g.chrome) return g.chrome as unknown as typeof chrome;
    return undefined;
  } catch {
    return undefined;
  }
}

export function browserFamily(): BrowserFamily {
  try {
    const g = globalThis as Record<string, unknown>;
    if (g.browser && (g as { browser?: { runtime?: { getBrowserInfo?: unknown } } }).browser?.runtime?.getBrowserInfo) {
      return 'firefox';
    }
    if (g.chrome) return 'chromium';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Promisified storage.local with in-memory fallback (for tests / non-extension pages). */
const memStore = new Map<string, unknown>();

export async function storageGet<T>(key: string, fallback: T): Promise<T> {
  const api = extensionApi();
  try {
    if (api?.storage?.local) {
      const out = await api.storage.local.get(key);
      if (out && key in (out as object)) return (out as Record<string, T>)[key] as T;
      return fallback;
    }
  } catch {
    /* fall through to memory */
  }
  return (memStore.has(key) ? memStore.get(key) : fallback) as T;
}

export async function storageSet(key: string, value: unknown): Promise<void> {
  const api = extensionApi();
  try {
    if (api?.storage?.local) {
      await api.storage.local.set({ [key]: value });
      return;
    }
  } catch {
    /* fall through */
  }
  memStore.set(key, value);
}

export async function storageRemove(keys: string | string[]): Promise<void> {
  const api = extensionApi();
  try {
    if (api?.storage?.local) {
      await api.storage.local.remove(keys);
      return;
    }
  } catch {
    /* fall through */
  }
  (Array.isArray(keys) ? keys : [keys]).forEach((k) => memStore.delete(k));
}

export async function getActiveTab(): Promise<{ id?: number; url?: string; title?: string } | null> {
  const api = extensionApi();
  try {
    if (api?.tabs?.query) {
      const tabs = await api.tabs.query({ active: true, currentWindow: true });
      const t = tabs?.[0];
      if (t) return { id: t.id, url: t.url, title: t.title };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function openDashboard(extraHash = ''): Promise<void> {
  const api = extensionApi();
  const url = api?.runtime?.getURL
    ? api.runtime.getURL('dashboard/dashboard.html' + extraHash)
    : 'dashboard/dashboard.html' + extraHash;
  try {
    if (api?.tabs?.create) {
      await api.tabs.create({ url });
      return;
    }
  } catch {
    /* fall through */
  }
  try {
    globalThis.open?.(url, '_blank');
  } catch {
    /* ignore */
  }
}

/** Blob download that works in every target browser (anchor + object URL). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}
