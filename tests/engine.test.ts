import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { analyzeDocument } from '../src/lib/analyzers/engine';
import { DEFAULT_THRESHOLDS } from '../src/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
function docOf(name: string, url: string): Document {
  const html = readFileSync(resolve(__dirname, `fixtures/${name}`), 'utf-8');
  const dom = new JSDOM(html, { url });
  return dom.window.document as unknown as Document;
}

describe('engine: complete fixture', () => {
  it('extracts metadata, headings, social, jsonld, images, links honestly', () => {
    const doc = docOf('complete.html', 'https://example.com/complete');
    const r = analyzeDocument(doc, 'https://example.com/complete', DEFAULT_THRESHOLDS);
    expect(r.pageTitle).toContain('Complete Test Page');
    expect(r.meta.find((m) => m.key === 'title')?.status).toBe('passed');
    expect(r.headingCounts.h1).toBe(1);
    expect(r.headings.length).toBe(4);
    expect(r.social.og['og:title']).toBe('Complete OG Title');
    expect(r.jsonLd.length).toBe(1);
    expect(r.jsonLd[0].parseError).toBeNull();
    expect(r.jsonLd[0].types).toContain('Article');
    expect(r.images.length).toBe(2);
    expect(r.images.filter((i) => i.altState === 'missing').length).toBe(0);
    const kinds = r.links.map((l) => l.kind);
    expect(kinds).toContain('internal');
    expect(kinds).toContain('external');
    expect(r.summary.total).toBeGreaterThan(5);
    // No fabricated scores/headers
    expect(r.capabilities.headersAvailable).toBe(false);
  });
});

describe('engine: issues fixture', () => {
  it('flags duplicates, noindex, invalid canonical, bad JSON, heading + link problems', () => {
    const doc = docOf('issues.html', 'https://example.com/bad');
    const r = analyzeDocument(doc, 'https://example.com/bad', DEFAULT_THRESHOLDS);
    const ids = new Set(r.findings.map((f) => f.id));
    expect(ids.has('meta-duplicate-title')).toBe(true);
    expect(ids.has('meta-robots-noindex')).toBe(true);
    expect(ids.has('meta-invalid-canonical')).toBe(true);
    expect(ids.has('sd-invalid')).toBe(true);
    expect(ids.has('sd-empty')).toBe(true);
    expect(ids.has('sd-dupe-id')).toBe(true);
    expect(ids.has('headings-multi-h1')).toBe(true);
    expect(ids.has('headings-empty')).toBe(true);
    expect(ids.has('links-empty')).toBe(true);
    expect(ids.has('links-blank-rel')).toBe(true);
    expect(ids.has('img-missing-alt')).toBe(true);
    expect(r.summary.critical).toBeGreaterThanOrEqual(2);
    // Every finding has evidence-backed recommendation
    for (const f of r.findings) {
      expect(f.title.length).toBeGreaterThan(0);
      expect(f.recommendation.length).toBeGreaterThan(0);
      expect(['critical', 'warning', 'info', 'passed']).toContain(f.severity);
    }
  });
});

describe('engine: edge fixture (unicode, relative URLs)', () => {
  it('resolves relative URLs and handles unicode safely', () => {
    const doc = docOf('edge.html', 'https://example.com/%C3%BCn%C3%AFc%C3%B6d%C3%A9?x=1');
    const r = analyzeDocument(doc, 'https://example.com/page?x=1', DEFAULT_THRESHOLDS);
    expect(r.pageTitle).toContain('Café');
    // relative og:image resolves against page URL
    const ogImg = r.social.og['og:image'];
    expect(ogImg).toBe('/relative/og.png');
    // JSON-LD array of two objects parses
    expect(r.jsonLd[0].parseError).toBeNull();
    expect(r.links.find((l) => l.text === 'relativ')?.kind).toBe('internal');
    expect(r.links.find((l) => l.text === 'call')?.kind).toBe('telephone');
  });
});

describe('engine: empty document', () => {
  it('reports empty states instead of mock data', () => {
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://example.com/' });
    const r = analyzeDocument(dom.window.document as unknown as Document, 'https://example.com/', DEFAULT_THRESHOLDS);
    expect(r.headings.length).toBe(0);
    expect(r.images.length).toBe(0);
    expect(r.jsonLd.length).toBe(0);
    expect(r.findings.some((f) => f.id === 'meta-missing-title')).toBe(true);
    expect(r.findings.some((f) => f.id === 'headings-none')).toBe(true);
  });
});
