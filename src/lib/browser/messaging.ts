/** Typed messaging with timeout + validation. Never evals page strings. */
import type { AnalysisResult, ExtensionMessage } from '../../types';
import { isAnalyzeResponse } from '../../types';
import { extensionApi } from './api';
import { checkPageSupport } from './capabilities';

const TIMEOUT_MS = 15000;

export async function requestAnalysisFromActiveTab(): Promise<AnalysisResult> {
  const api = extensionApi();
  if (!api?.tabs || !api?.scripting) {
    throw new Error('Extension APIs are unavailable in this context.');
  }
  const tabs = await api.tabs.query({ active: true, currentWindow: true });
  const tab = tabs?.[0];
  if (!tab?.id) throw new Error('No active tab found.');
  if (tab.url) {
    const s = checkPageSupport(tab.url);
    if (!s.supported) throw new Error(s.reason ?? 'This page cannot be analyzed.');
  }
  // 1) Try direct message (content script already present)
  try {
    const direct = await sendToTabWithTimeout(tab.id, { type: 'SITESCOPE_ANALYZE_REQUEST' });
    const parsed = parseAnalysisResponse(direct);
    if (parsed) return parsed;
  } catch {
    /* fall through to injection */
  }
  // 2) Inject content script programmatically, then ask again
  try {
    await api.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  } catch (e) {
    throw new Error(
      'Could not access this page. The browser may block extensions here (e.g. web store, internal pages, PDFs).',
    );
  }
  const after = await sendToTabWithTimeout(tab.id, { type: 'SITESCOPE_ANALYZE_REQUEST' });
  const parsed = parseAnalysisResponse(after);
  if (parsed) return parsed;
  throw new Error('The page did not respond to analysis. Try reloading the page and analyzing again.');
}

function sendToTabWithTimeout(tabId: number, msg: ExtensionMessage): Promise<unknown> {
  const api = extensionApi();
  if (!api?.tabs) return Promise.reject(new Error('Extension tabs API is unavailable.'));
  return sendMessageToTab(api as MinimalTabSender, tabId, msg, TIMEOUT_MS);
}

/**
 * Sends a message to a tab, supporting BOTH Chrome-style callbacks and
 * Firefox-style (`browser.*`) promises. The `browser.*` namespace ignores the
 * callback argument and returns a promise instead; handling both keeps the
 * shared codebase portable without browser-name checks.
 */
export interface MinimalTabSender {
  tabs: {
    sendMessage: (tabId: number, msg: unknown, cb?: (resp: unknown) => void) => unknown;
  };
  runtime?: { lastError?: { message?: string } };
}

export function sendMessageToTab(
  api: MinimalTabSender,
  tabId: number,
  msg: ExtensionMessage,
  timeoutMs = TIMEOUT_MS,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = globalThis.setTimeout(() => {
      if (!done) {
        done = true;
        reject(new Error('Analysis timed out (15s).'));
      }
    }, timeoutMs);
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      globalThis.clearTimeout(timer);
      fn();
    };
    const lastErrorOf = (): { message?: string } | undefined =>
      api.runtime?.lastError ??
      (globalThis as unknown as { chrome?: { runtime?: { lastError?: { message?: string } } } }).chrome?.runtime?.lastError;
    try {
      const maybe = api.tabs.sendMessage(tabId, msg, (resp: unknown) => {
        finish(() => {
          const err = lastErrorOf();
          if (err?.message) reject(new Error(err.message));
          else resolve(resp);
        });
      });
      // Firefox promise style: the callback above is ignored and a promise is returned.
      if (maybe && typeof (maybe as Promise<unknown>).then === 'function') {
        (maybe as Promise<unknown>).then(
          (resp) => finish(() => resolve(resp)),
          (err) => finish(() => reject(err instanceof Error ? err : new Error(String(err)))),
        );
      }
    } catch (e) {
      finish(() => reject(e instanceof Error ? e : new Error(String(e))));
    }
  });
}

/** Same dual-style handling for runtime.sendMessage (used by the dashboard relay). */
export function sendRuntimeMessage(
  api: {
    runtime: {
      sendMessage: (msg: unknown, cb?: (resp: unknown) => void) => unknown;
      lastError?: { message?: string };
    };
  },
  msg: ExtensionMessage,
  timeoutMs = TIMEOUT_MS,
): Promise<unknown> {
  return sendMessageToTab(
    { tabs: { sendMessage: (_t: number, m: unknown, cb?: (r: unknown) => void) => api.runtime.sendMessage(m, cb) }, runtime: api.runtime },
    0,
    msg,
    timeoutMs,
  );
}

export function parseAnalysisResponse(raw: unknown): AnalysisResult | null {
  if (!isAnalyzeResponse(raw)) return null;
  if (!raw.ok || !raw.result) return null;
  return raw.result as AnalysisResult;
}
