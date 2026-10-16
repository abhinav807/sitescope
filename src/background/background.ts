/** Background service worker (MV3) / background script (Firefox).
 * No browsing surveillance: only responds to user-triggered analysis + dashboard open.
 * No network calls, no telemetry.
 *
 * Message validation: incoming messages must match the known-type allowlist
 * (see messaging.ts); content-script responses are shape-checked before being
 * forwarded so a compromised or buggy page context cannot push arbitrary
 * payloads into extension pages.
 */
import { isKnownIncomingMessage, isPlausibleAnalysisResult, isValidTabId } from '../lib/browser/messaging';

type Msg = { type?: string; [k: string]: unknown };

function api(): typeof chrome | undefined {
  try {
    const g = globalThis as Record<string, unknown>;
    return ((g.browser ?? g.chrome) as typeof chrome | undefined) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Forwards only validated analysis responses; rejects anything else safely. */
function forwardAnalysisResponse(raw: unknown, sendResponse: (r: unknown) => void): boolean {
  if (
    typeof raw === 'object' &&
    raw !== null &&
    (raw as Record<string, unknown>).type === 'SITESCOPE_ANALYZE_RESPONSE'
  ) {
    const body = raw as Record<string, unknown>;
    if (body.ok === true && isPlausibleAnalysisResult(body.result)) {
      sendResponse(raw);
      return true;
    }
    if (body.ok !== true && typeof body.error === 'string') {
      sendResponse({ type: 'SITESCOPE_ANALYZE_RESPONSE', ok: false, error: body.error.slice(0, 500) });
      return true;
    }
  }
  sendResponse({
    type: 'SITESCOPE_ANALYZE_RESPONSE',
    ok: false,
    error: 'The page returned an invalid analysis response.',
  });
  return true;
}

const ext = api();
ext?.runtime?.onMessage?.addListener((msg: Msg, sender, sendResponse: (r: unknown) => void) => {
  if (!isKnownIncomingMessage(msg)) return undefined;
  void sender;
  if (msg.type === 'SITESCOPE_OPEN_DASHBOARD') {
    (async () => {
      try {
        const url = ext?.runtime?.getURL ? ext.runtime.getURL('dashboard/dashboard.html') : 'dashboard/dashboard.html';
        await ext?.tabs?.create({ url });
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    })();
    return true;
  }
  if (msg.type === 'SITESCOPE_ANALYZE_VIA_BACKGROUND') {
    (async () => {
      try {
        const tabs = await ext!.tabs!.query({ active: true, currentWindow: true });
        const tab = tabs?.[0];
        if (!isValidTabId(tab?.id)) {
          sendResponse({ type: 'SITESCOPE_ANALYZE_RESPONSE', ok: false, error: 'No active tab.' });
          return;
        }
        const tabId: number = tab.id as number;
        // Forward to content script; inject first if needed.
        try {
          const resp = await ext!.tabs!.sendMessage(tabId, { type: 'SITESCOPE_ANALYZE_REQUEST' });
          forwardAnalysisResponse(resp, sendResponse);
          return;
        } catch {
          /* inject then retry */
        }
        try {
          await ext!.scripting!.executeScript({ target: { tabId }, files: ['content.js'] });
        } catch {
          sendResponse({
            type: 'SITESCOPE_ANALYZE_RESPONSE',
            ok: false,
            error: 'This page blocks extensions (internal pages, web store, PDFs).',
          });
          return;
        }
        try {
          const resp = await ext!.tabs!.sendMessage(tabId, { type: 'SITESCOPE_ANALYZE_REQUEST' });
          forwardAnalysisResponse(resp, sendResponse);
        } catch {
          sendResponse({
            type: 'SITESCOPE_ANALYZE_RESPONSE',
            ok: false,
            error: 'The page did not respond. Reload and try again.',
          });
        }
      } catch (e) {
        sendResponse({ type: 'SITESCOPE_ANALYZE_RESPONSE', ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    })();
    return true;
  }
  return undefined;
});

// Clear stale per-tab state on navigation (avoid showing results for the wrong page).
ext?.tabs?.onUpdated?.addListener((_tabId, info) => {
  if (info.status === 'loading') {
    // No-op by design: popup always re-analyzes on open. Kept to document lifecycle handling.
  }
});

export {};
