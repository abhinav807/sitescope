import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { analyzeDocument } from '../src/lib/analyzers/engine';
import {
  isKnownIncomingMessage,
  isPlausibleAnalysisResult,
  isValidTabId,
  parseAnalysisResponse,
} from '../src/lib/browser/messaging';

/** Risk 2 regression tests: runtime message/response validation. */

function realResult() {
  const dom = new JSDOM('<!doctype html><html lang="en"><head><title>Realistic Test Page Title Here</title></head><body><h1>Hi</h1></body></html>', {
    url: 'https://example.com/',
  });
  return analyzeDocument(dom.window.document as unknown as Document, 'https://example.com/');
}

function envelope(result: unknown) {
  return { type: 'SITESCOPE_ANALYZE_RESPONSE', ok: true, result };
}

describe('isKnownIncomingMessage', () => {
  it('accepts the two privileged types, rejects everything else', () => {
    expect(isKnownIncomingMessage({ type: 'SITESCOPE_OPEN_DASHBOARD' })).toBe(true);
    expect(isKnownIncomingMessage({ type: 'SITESCOPE_ANALYZE_VIA_BACKGROUND' })).toBe(true);
    for (const bad of [null, undefined, 'x', 42, {}, { type: 'PWN' }, { type: 42 }, { type: '' }]) {
      expect(isKnownIncomingMessage(bad)).toBe(false);
    }
  });
});

describe('isValidTabId', () => {
  it.each([[1, true], [0, true], [987654, true], [-1, false], [1.5, false], [NaN, false], ['1', false], [undefined, false], [null, false]])(
    'tabId %j -> %s',
    (id, expected) => expect(isValidTabId(id)).toBe(expected),
  );
});

describe('parseAnalysisResponse with shape + size guards', () => {
  it('accepts a genuine engine result', () => {
    const r = realResult();
    expect(parseAnalysisResponse(envelope(r))).toEqual(r);
    expect(isPlausibleAnalysisResult(r)).toBe(true);
  });

  it('rejects malformed envelopes', () => {
    for (const bad of [null, undefined, 'x', 42, {}, { type: 'OTHER', ok: true }, { type: 'SITESCOPE_ANALYZE_RESPONSE', ok: false }]) {
      expect(parseAnalysisResponse(bad)).toBeNull();
    }
    expect(parseAnalysisResponse({ type: 'SITESCOPE_ANALYZE_RESPONSE', ok: true })).toBeNull();
    expect(parseAnalysisResponse({ type: 'SITESCOPE_ANALYZE_RESPONSE', ok: true, result: null })).toBeNull();
  });

  it('rejects wrong-shaped results', () => {
    const base = realResult() as unknown as Record<string, unknown>;
    const variants: unknown[] = [
      { ...base, pageUrl: 42 },
      { ...base, pageUrl: '' },
      { ...base, pageTitle: null },
      { ...base, findings: 'nope' },
      { ...base, findings: [{ id: 'x' }] }, // missing severity/title/...
      { ...base, findings: [{ id: 'x', category: 'c', title: 't', severity: 'CRITICAL', explanation: 'e', recommendation: 'r' }] },
      { ...base, findings: new Array(20001).fill({ id: 'x', category: 'c', title: 't', severity: 'info', explanation: 'e', recommendation: 'r' }) },
    ];
    for (const v of variants) {
      expect(isPlausibleAnalysisResult(v)).toBe(false);
      expect(parseAnalysisResponse(envelope(v))).toBeNull();
    }
  });

  it('rejects oversized payloads without throwing', () => {
    const big = realResult() as unknown as Record<string, unknown>;
    big.pageTitle = 'x'.repeat(6 * 1024 * 1024);
    expect(isPlausibleAnalysisResult(big)).toBe(false);
    expect(parseAnalysisResponse(envelope(big))).toBeNull();
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    expect(isPlausibleAnalysisResult(cyclic)).toBe(false);
  });
});
