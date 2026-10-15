import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { analyzeDocument } from '../src/lib/analyzers/engine';
import { linksToCsv, imagesToCsv, findingsToCsv, analysisToJson, reportToHtml } from '../src/lib/export';
import { checkPageSupport } from '../src/lib/browser/capabilities';
import { escapeCsvCell, escapeHtml } from '../src/lib/utils/sanitize';
import { maskQuery, isSafeHref, exportFilename } from '../src/lib/utils/url';

function sampleResult() {
  const dom = new JSDOM('<!doctype html><html lang="en"><head><title>T</title></head><body><h1>Hi</h1><a href="https://example.com/a">A</a><img src="x.png" alt="x"></body></html>', { url: 'https://example.com/?token=secret&x=1' });
  return analyzeDocument(dom.window.document as unknown as Document, 'https://example.com/?token=secret&x=1');
}

describe('exports use real results and escape correctly', () => {
  it('JSON round-trips', () => {
    const r = sampleResult();
    const j = analysisToJson(r);
    const back = JSON.parse(j);
    expect(back.pageUrl).toBe(r.pageUrl);
    expect(back.findings.length).toBe(r.findings.length);
  });
  it('CSV escapes quotes/commas and has headers', () => {
    expect(escapeCsvCell('a"b,c\nd')).toBe('"a""b,c\nd"');
    const r = sampleResult();
    const csv = linksToCsv(r);
    expect(csv.split('\r\n')[0]).toBe('text,url,kind,rel,target,accessible_name');
    expect(csv).toContain('https://example.com/a');
    expect(imagesToCsv(r).split('\r\n')[0].split(',')[0]).toBe('src');
    expect(findingsToCsv(r).split('\r\n')[0]).toBe('severity,category,title,explanation,recommendation');
  });
  it('HTML report escapes untrusted content and masks queries', () => {
    const dom = new JSDOM('<!doctype html><html><head><title><script>alert(1)</script></title></head><body></body></html>', { url: 'https://example.com/?token=abc' });
    const r = analyzeDocument(dom.window.document as unknown as Document, 'https://example.com/?token=abc');
    const html = reportToHtml(r);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    // Sensitive query values are masked (URL-encoded bullets) and raw secret never appears in the page line
    expect(html).toContain('%E2%80%A2%E2%80%A2%E2%80%A2%E2%80%A2');
    expect(html).not.toContain('token=abc');
    expect(escapeHtml('<a href="x">&')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;');
  });
  it('filenames are hostname+date based, no raw queries', () => {
    const n = exportFilename('Example.COM!', 'json');
    expect(n).toMatch(/^sitescope-example\.com-\d{8}-\d{4}\.json$/);
    expect(n).not.toContain('?');
  });
});

describe('permissions + unsupported pages + safety', () => {
  it('blocks restricted URLs gracefully', () => {
    expect(checkPageSupport('chrome://settings').supported).toBe(false);
    expect(checkPageSupport('about:blank').supported).toBe(false);
    expect(checkPageSupport('https://chrome.google.com/webstore/x').supported).toBe(false);
    expect(checkPageSupport('https://example.com/page').supported).toBe(true);
    expect(checkPageSupport('not a url %%').supported).toBe(false);
  });
  it('masks sensitive query params and gates unsafe schemes', () => {
    expect(maskQuery('https://h/?token=abc&x=1')).toContain('token=%E2%80%A2');
    expect(maskQuery('https://h/?x=1')).toContain('x=1');
    expect(isSafeHref('javascript:alert(1)')).toBe(false);
    expect(isSafeHref('https://example.com/x')).toBe(true);
    expect(isSafeHref('/relative')).toBe(true);
    expect(isSafeHref('#frag')).toBe(true);
  });
  it('never executes page content (content script has no eval)', async () => {
    const src = await import('node:fs').then((fs) => fs.readFileSync('src/content/content.ts', 'utf-8'));
    expect(src).not.toMatch(/\beval\s*\(/);
    expect(src).not.toContain('innerHTML');
  });
});
