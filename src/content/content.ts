/** Content script: read-only DOM analysis. No persistent page modifications. */
import { analyzeDocument } from '../lib/analyzers/engine';
import { DEFAULT_THRESHOLDS } from '../types';
import type { AnalyzeResponseMessage } from '../types';

async function loadThresholds() {
  try {
    const g = globalThis as unknown as {
      browser?: { storage?: { local?: { get: (k: string) => Promise<Record<string, unknown>> } } };
      chrome?: { storage?: { local?: { get: (k: string, cb: (r: Record<string, unknown>) => void) => void } } };
    };
    if (g.browser?.storage?.local) {
      const out = await g.browser.storage.local.get('sitescope:settings:v1');
      const s = (out?.['sitescope:settings:v1'] ?? {}) as Record<string, number>;
      return {
        titleMin: Number(s.titleMin ?? DEFAULT_THRESHOLDS.titleMin),
        titleMax: Number(s.titleMax ?? DEFAULT_THRESHOLDS.titleMax),
        descriptionMin: Number(s.descriptionMin ?? DEFAULT_THRESHOLDS.descriptionMin),
        descriptionMax: Number(s.descriptionMax ?? DEFAULT_THRESHOLDS.descriptionMax),
        largeImageMinWidth: Number(s.largeImageMinWidth ?? DEFAULT_THRESHOLDS.largeImageMinWidth),
      };
    }
    if (g.chrome?.storage?.local) {
      const s = await new Promise<Record<string, unknown>>((resolve) => {
        g.chrome!.storage!.local!.get('sitescope:settings:v1', (r) => resolve(r ?? {}));
      });
      const inner = (s?.['sitescope:settings:v1'] ?? {}) as Record<string, number>;
      return {
        titleMin: Number(inner.titleMin ?? DEFAULT_THRESHOLDS.titleMin),
        titleMax: Number(inner.titleMax ?? DEFAULT_THRESHOLDS.titleMax),
        descriptionMin: Number(inner.descriptionMin ?? DEFAULT_THRESHOLDS.descriptionMin),
        descriptionMax: Number(inner.descriptionMax ?? DEFAULT_THRESHOLDS.descriptionMax),
        largeImageMinWidth: Number(inner.largeImageMinWidth ?? DEFAULT_THRESHOLDS.largeImageMinWidth),
      };
    }
  } catch {
    /* use defaults */
  }
  return { ...DEFAULT_THRESHOLDS };
}

function handleMessage(
  msg: unknown,
  _sender: unknown,
  sendResponse: (r: AnalyzeResponseMessage) => void,
): boolean | undefined {
  if (typeof msg !== 'object' || msg === null) return undefined;
  const t = (msg as Record<string, unknown>).type;
  if (t === 'SITESCOPE_HIGHLIGHT_HEADINGS') {
    toggleHeadingHighlight();
    sendResponse({ type: 'SITESCOPE_ANALYZE_RESPONSE', ok: true });
    return true;
  }
  if (t !== 'SITESCOPE_ANALYZE_REQUEST') return undefined;
  (async () => {
    try {
      const thresholds = await loadThresholds();
      const result = analyzeDocument(document, location.href, thresholds);
      sendResponse({ type: 'SITESCOPE_ANALYZE_RESPONSE', ok: true, result });
    } catch (e) {
      sendResponse({
        type: 'SITESCOPE_ANALYZE_RESPONSE',
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  })();
  return true; // async response
}

const HIGHLIGHT_ATTR = 'data-sitescope-highlight';

function toggleHeadingHighlight(): void {
  try {
    const existing = document.querySelectorAll(`[${HIGHLIGHT_ATTR}]`);
    if (existing.length) {
      existing.forEach((el) => {
        el.removeAttribute(HIGHLIGHT_ATTR);
        (el as HTMLElement).style.removeProperty('outline');
      });
      document.getElementById('sitescope-heading-style')?.remove();
      return;
    }
    const style = document.createElement('style');
    style.id = 'sitescope-heading-style';
    style.textContent = `[${HIGHLIGHT_ATTR}]{outline:2px solid #c8f04a !important;outline-offset:2px !important;}`;
    document.head.appendChild(style);
    document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((el) => {
      el.setAttribute(HIGHLIGHT_ATTR, '1');
    });
  } catch {
    /* never break the page */
  }
}

try {
  const g = globalThis as unknown as {
    browser?: { runtime?: { onMessage?: { addListener: (fn: typeof handleMessage) => void } } };
    chrome?: { runtime?: { onMessage?: { addListener: (fn: typeof handleMessage) => void } } };
  };
  g.browser?.runtime?.onMessage?.addListener(handleMessage);
  g.chrome?.runtime?.onMessage?.addListener(handleMessage);
} catch {
  /* content script context without extension APIs (tests) */
}
