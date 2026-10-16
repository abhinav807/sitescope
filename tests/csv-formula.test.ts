import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { escapeCsvCell, neutralizeCsvFormula } from '../src/lib/utils/sanitize';
import { analyzeDocument } from '../src/lib/analyzers/engine';
import { linksToCsv, imagesToCsv, findingsToCsv } from '../src/lib/export';

/**
 * Risk 1 regression tests: spreadsheet formula injection.
 * Quoting (",\n\r) and formula neutralization are tested SEPARATELY:
 * quoting preserves content, neutralization only touches trigger first-chars.
 */

describe('CSV quoting (unchanged behavior)', () => {
  it('quotes commas, quotes, and newlines without adding markers', () => {
    expect(escapeCsvCell('a"b,c\nd')).toBe('"a""b,c\nd"');
    expect(escapeCsvCell('plain')).toBe('plain');
    expect(escapeCsvCell('')).toBe('');
    expect(escapeCsvCell(42)).toBe('42');
    expect(escapeCsvCell(null)).toBe('');
  });
});

describe('formula neutralization', () => {
  it.each([
    '=HYPERLINK("http://evil","x")',
    '=cmd|\'/c calc\'!A0',
    '+2+3+cmd',
    '-2+3+cmd',
    '@SUM(1+1)',
    '\t=1+1',
    '\r=1+1',
  ])('prefixes trigger cell %j', (cell) => {
    expect(neutralizeCsvFormula(cell).startsWith("'")).toBe(true);
    expect(escapeCsvCell(cell).replace(/^"|"$/g, '').startsWith("'")).toBe(true);
  });

  it('leaves ordinary values byte-identical', () => {
    for (const v of ['', 'hello world', 'a-b', 'x=y', 'price $5', ' leading space', '42', '-5 items', '100%']) {
      // '-5 items' starts with '-' so it IS prefixed (documented, invisible in Excel).
      if (v.startsWith('-')) {
        expect(neutralizeCsvFormula(v)).toBe(`'${v}`);
      } else {
        expect(neutralizeCsvFormula(v)).toBe(v);
      }
    }
    expect(escapeCsvCell('a-b')).toBe('a-b');
    expect(escapeCsvCell('x=y')).toBe('x=y');
  });
});

describe('all CSV export paths neutralize hostile page content', () => {
  function hostileDoc() {
    const dom = new JSDOM(
      '<!doctype html><html><head><title>=cmd hostile</title></head><body>' +
        '<h1>=1+1</h1>' +
        '<a href="https://example.com/?x==">=cmd|\'/c calc\'!A0</a>' +
        '<img src="x.png" alt="+autofill">' +
        '</body></html>',
      { url: 'https://example.com/' },
    );
    return analyzeDocument(dom.window.document as unknown as Document, 'https://example.com/');
  }

  it('links CSV: hostile text and URLs cannot start a formula', () => {
    const csv = linksToCsv(hostileDoc());
    for (const line of csv.split('\r\n').slice(1)) {
      // Split naive CSV on commas not inside quotes for first-field check.
      const first = line.startsWith('"') ? line.slice(1) : line.split(',')[0];
      expect('=+-@\t\r'.includes(first.charAt(0)) && !first.startsWith("'")).toBe(false);
    }
    expect(csv).toContain("'=cmd");
  });

  it('images CSV: hostile alt text is neutralized', () => {
    const csv = imagesToCsv(hostileDoc());
    expect(csv).toContain("'+autofill");
  });

  it('findings CSV: trigger-leading cells are neutralized, headers intact', () => {
    // NOTE: findings CSV exports severity/category/title/explanation/recommendation
    // only (evidence is excluded by design). Page-controlled text can therefore only
    // appear mid-cell after static prefixes — except when a title itself is hostile,
    // which we exercise synthetically through the real findingsToCsv path.
    const base = hostileDoc();
    const evil = {
      id: 'test-evil', category: 'metadata', severity: 'warning',
      title: '=EVIL()', explanation: '+evil explanation', recommendation: '@evil rec',
    } as const;
    const csv = findingsToCsv({ ...base, findings: [...base.findings, { ...evil, severity: evil.severity as 'warning', category: evil.category as 'metadata' }] });
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('severity,category,title,explanation,recommendation');
    expect(csv).toContain("'=EVIL()");
    expect(csv).toContain("'+evil explanation");
    expect(csv).toContain("'@evil rec");
    // Invariant over every row: no data cell may begin with a raw trigger char.
    for (const line of lines.slice(1)) {
      for (const cell of line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)) {
        const inner = cell.startsWith('"') ? cell.slice(1, -1).replace(/""/g, '"') : cell;
        if (inner.length && '=+-@\t\r'.includes(inner.charAt(0))) {
          expect(inner.startsWith("'")).toBe(true);
        }
      }
    }
  });
});
