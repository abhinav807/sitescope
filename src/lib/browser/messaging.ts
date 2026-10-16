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
  if (!isPlausibleAnalysisResult(raw.result)) return null;
  return raw.result as AnalysisResult;
}

/**
 * Runtime shape guard for analysis results. TypeScript types are compile-time
 * only — anything crossing the extension messaging boundary (content script,
 * background relay, storage) is untrusted until validated here.
 *
 * Checks are intentionally shallow and bounded: required top-level fields with
 * correct primitive types, a findings array within sane limits, per-finding
 * required fields, and an overall serialized-size cap. Returns false (reject)
 * rather than throwing, so callers degrade to error states instead of crashing.
 */
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_FINDINGS = 20000;
const MAX_FINDING_FIELD_CHARS = 20000;

const SEVERITIES = new Set(['critical', 'warning', 'info', 'passed']);

export function isPlausibleAnalysisResult(raw: unknown): boolean {
  if (typeof raw !== 'object' || raw === null) return false;
  try {
    // Cheap size gate first: stringify cost is linear and bounded by the cap.
    const approx = JSON.stringify(raw);
    if (typeof approx !== 'string' || approx.length > MAX_RESPONSE_BYTES) return false;
    const r = raw as Record<string, unknown>;
    if (typeof r.pageUrl !== 'string' || r.pageUrl.length === 0 || r.pageUrl.length > 4000) return false;
    if (typeof r.pageTitle !== 'string' || typeof r.analyzedAt !== 'string') return false;
    if (!Array.isArray(r.findings) || r.findings.length > MAX_FINDINGS) return false;
    for (const f of r.findings) {
      if (typeof f !== 'object' || f === null) return false;
      const fo = f as Record<string, unknown>;
      if (typeof fo.id !== 'string' || fo.id.length === 0 || fo.id.length > 200) return false;
      if (typeof fo.category !== 'string' || typeof fo.title !== 'string') return false;
      if (typeof fo.severity !== 'string' || !SEVERITIES.has(fo.severity)) return false;
      if (typeof fo.explanation !== 'string' || typeof fo.recommendation !== 'string') return false;
      if (fo.explanation.length > MAX_FINDING_FIELD_CHARS || fo.recommendation.length > MAX_FINDING_FIELD_CHARS) return false;
    }
    return true;
  } catch {
    // Unstringifiable (BigInt, cycles) or exotic — reject, never throw.
    return false;
  }
}

/** Message-type allowlist for the background relay (unknown types are ignored). */
const KNOWN_INCOMING_TYPES = new Set(['SITESCOPE_OPEN_DASHBOARD', 'SITESCOPE_ANALYZE_VIA_BACKGROUND']);

export function isKnownIncomingMessage(msg: unknown): msg is { type: string; [k: string]: unknown } {
  if (typeof msg !== 'object' || msg === null) return false;
  const t = (msg as Record<string, unknown>).type;
  return typeof t === 'string' && KNOWN_INCOMING_TYPES.has(t);
}

/** Tab IDs crossing the boundary must be finite non-negative integers. */
export function isValidTabId(id: unknown): id is number {
  return typeof id === 'number' && Number.isInteger(id) && id >= 0;
}
