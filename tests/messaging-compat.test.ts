import { describe, it, expect } from 'vitest';
import { sendMessageToTab, sendRuntimeMessage, parseAnalysisResponse } from '../src/lib/browser/messaging';

/**
 * Regression tests for Firefox interop (Release Verification Sprint).
 * `browser.tabs.sendMessage` (promise style) ignores the callback argument,
 * while `chrome.tabs.sendMessage` (callback style) returns undefined.
 * Both must resolve — previously the Firefox shape hung until timeout.
 */

function chromeStyleApi(response: unknown) {
  return {
    tabs: {
      sendMessage: (_tabId: number, _msg: unknown, cb?: (r: unknown) => void) => {
        globalThis.setTimeout(() => cb?.(response), 5);
        return undefined;
      },
    },
    runtime: {},
  };
}

function firefoxStyleApi(response: unknown) {
  return {
    tabs: {
      // Ignores callback, returns a promise (mirrors browser.* behavior).
      sendMessage: (_tabId: number, _msg: unknown, _cb?: (r: unknown) => void) => Promise.resolve(response),
    },
    runtime: {},
  };
}

function firefoxRejectingApi() {
  return {
    tabs: {
      sendMessage: () => Promise.reject(new Error('Could not establish connection. Receiving end does not exist.')),
    },
    runtime: {},
  };
}

const OK = {
  type: 'SITESCOPE_ANALYZE_RESPONSE',
  ok: true,
  // Minimal shape-valid result (see isPlausibleAnalysisResult).
  result: { pageUrl: 'https://example.com/', pageTitle: 't', analyzedAt: '2026-01-01', findings: [] },
};

describe('sendMessageToTab dual-style handling', () => {
  it('resolves via Chrome-style callback API', async () => {
    const r = await sendMessageToTab(chromeStyleApi(OK), 1, { type: 'SITESCOPE_ANALYZE_REQUEST' }, 2000);
    expect(r).toEqual(OK);
  });
  it('resolves via Firefox-style promise API (callback ignored)', async () => {
    const r = await sendMessageToTab(firefoxStyleApi(OK), 1, { type: 'SITESCOPE_ANALYZE_REQUEST' }, 2000);
    expect(r).toEqual(OK);
  });
  it('rejects promptly on Firefox-style promise rejection (no 15s hang)', async () => {
    const start = Date.now();
    await expect(sendMessageToTab(firefoxRejectingApi(), 1, { type: 'SITESCOPE_ANALYZE_REQUEST' }, 2000)).rejects.toThrow(
      /Could not establish connection/,
    );
    expect(Date.now() - start).toBeLessThan(1500);
  });
  it('times out when neither style responds', async () => {
    const silent = { tabs: { sendMessage: () => undefined }, runtime: {} };
    await expect(sendMessageToTab(silent, 1, { type: 'SITESCOPE_ANALYZE_REQUEST' }, 100)).rejects.toThrow(/timed out/);
  });
});

describe('sendRuntimeMessage dual-style handling', () => {
  it('resolves via Firefox-style runtime promise API', async () => {
    const api = {
      runtime: {
        sendMessage: (_m: unknown, _cb?: (r: unknown) => void) => Promise.resolve(OK),
      },
    };
    const r = await sendRuntimeMessage(api, { type: 'SITESCOPE_ANALYZE_REQUEST' }, 2000);
    expect(r).toEqual(OK);
    expect(parseAnalysisResponse(r)).toBeTruthy();
  });
});
