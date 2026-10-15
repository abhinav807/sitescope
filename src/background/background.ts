/** Background service worker (MV3) / background script (Firefox).
 * No browsing surveillance: only responds to user-triggered analysis + dashboard open.
 * No network calls, no telemetry.
 */

type Msg = { type?: string; [k: string]: unknown };

function api(): typeof chrome | undefined {
  try {
    const g = globalThis as Record<string, unknown>;
    return ((g.browser ?? g.chrome) as typeof chrome | undefined) ?? undefined;
  } catch {
    return undefined;
  }
}

const ext = api();
ext?.runtime?.onMessage?.addListener((msg: Msg, sender, sendResponse: (r: unknown) => void) => {
  if (!msg || typeof msg.type !== 'string') return undefined;
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
        if (!tab?.id) {
          sendResponse({ type: 'SITESCOPE_ANALYZE_RESPONSE', ok: false, error: 'No active tab.' });
          return;
        }
        // Forward to content script; inject first if needed.
        try {
          const resp = await ext!.tabs!.sendMessage(tab.id, { type: 'SITESCOPE_ANALYZE_REQUEST' });
          sendResponse(resp);
          return;
        } catch {
          /* inject then retry */
        }
        try {
          await ext!.scripting!.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
        } catch (e) {
          sendResponse({
            type: 'SITESCOPE_ANALYZE_RESPONSE',
            ok: false,
            error: 'This page blocks extensions (internal pages, web store, PDFs).',
          });
          return;
        }
        try {
          const resp = await ext!.tabs!.sendMessage(tab.id, { type: 'SITESCOPE_ANALYZE_REQUEST' });
          sendResponse(resp);
        } catch (e) {
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
