/** JSON-LD inspector: safe parse, @graph flattening, local consistency checks. Never executes code. */
import type { Finding, JsonLdBlock } from '../../types';
import { all } from '../utils/dom';
import { cleanEvidence, truncate } from '../utils/sanitize';

const KNOWN_TYPES = new Set([
  'Article', 'NewsArticle', 'BlogPosting', 'WebPage', 'WebSite', 'Organization',
  'Person', 'Product', 'Review', 'Recipe', 'Event', 'FAQPage', 'HowTo',
  'BreadcrumbList', 'ItemList', 'VideoObject', 'ImageObject', 'JobPosting',
  'LocalBusiness', 'Restaurant', 'Movie', 'Book', 'Course', 'Dataset', 'SoftwareApplication',
]);

function typesOf(node: unknown, acc: string[]): void {
  if (Array.isArray(node)) {
    node.forEach((n) => typesOf(n, acc));
    return;
  }
  if (node && typeof node === 'object') {
    const o = node as Record<string, unknown>;
    if (typeof o['@type'] === 'string') acc.push(o['@type']);
    else if (Array.isArray(o['@type'])) o['@type'].forEach((t) => typeof t === 'string' && acc.push(t));
    const g = o['@graph'];
    if (g) typesOf(g, acc);
    // Recurse one level for nested mainEntity etc. (bounded)
    for (const k of ['mainEntity', 'itemListElement', 'hasPart']) {
      if (o[k]) typesOf(o[k], acc);
    }
  }
}

function collectIds(node: unknown, acc: Map<string, number>): void {
  if (Array.isArray(node)) {
    node.forEach((n) => collectIds(n, acc));
    return;
  }
  if (node && typeof node === 'object') {
    const o = node as Record<string, unknown>;
    if (typeof o['@id'] === 'string' && o['@id']) acc.set(o['@id'], (acc.get(o['@id']) ?? 0) + 1);
    const g = o['@graph'];
    if (Array.isArray(g)) g.forEach((n) => collectIds(n, acc));
    else if (g && typeof g === 'object') collectIds(g, acc);
  }
}

export function analyzeStructuredData(doc: Document): { blocks: JsonLdBlock[]; findings: Finding[] } {
  const scripts = all(doc, 'script[type="application/ld+json" i]');
  const findings: Finding[] = [];
  const blocks: JsonLdBlock[] = scripts.map((s, i) => {
    const raw = (s.textContent ?? '').trim();
    if (!raw) return { index: i, raw: '', parsed: null, parseError: null, types: [], empty: true };
    try {
      const parsed = JSON.parse(raw);
      const types: string[] = [];
      typesOf(parsed, types);
      return { index: i, raw: truncate(raw, 20000), parsed, parseError: null, types, empty: false };
    } catch (e) {
      return { index: i, raw: truncate(raw, 20000), parsed: null, parseError: e instanceof Error ? e.message : String(e), types: [], empty: false };
    }
  });

  if (blocks.length === 0) {
    findings.push({ id: 'sd-none', category: 'structured-data', severity: 'info', title: 'No JSON-LD found', explanation: 'No application/ld+json scripts were found. Structured data is optional; Microdata/RDFa were not evaluated.', evidence: '0 JSON-LD scripts.', recommendation: 'Add JSON-LD (e.g. WebSite, Organization, Article) if rich results or knowledge panels matter for this page.' });
    return { blocks, findings };
  }

  const empties = blocks.filter((b) => b.empty);
  if (empties.length) findings.push({ id: 'sd-empty', category: 'structured-data', severity: 'warning', title: `${empties.length} empty JSON-LD block(s)`, explanation: 'Empty ld+json scripts add weight without meaning.', evidence: `block(s): ${empties.map((b) => `#${b.index + 1}`).join(', ')}`, recommendation: 'Remove empty structured-data scripts.' });

  const broken = blocks.filter((b) => b.parseError);
  if (broken.length) findings.push({ id: 'sd-invalid', category: 'structured-data', severity: 'critical', title: `${broken.length} invalid JSON-LD block(s)`, explanation: 'Malformed JSON cannot be read by search engines.', evidence: cleanEvidence(broken.map((b) => `#${b.index + 1}: ${b.parseError}`).join('; '), 300), recommendation: 'Fix JSON syntax (commas, quotes, brackets). Validate with the Rich Results Test before deploying.' });
  else findings.push({ id: 'sd-parse-ok', category: 'structured-data', severity: 'passed', title: `All ${blocks.length} JSON-LD block(s) parse`, explanation: 'Every ld+json script parsed as valid JSON.', recommendation: 'No action needed.' });

  const allTypes = blocks.flatMap((b) => b.types);
  const recognized = allTypes.filter((t) => KNOWN_TYPES.has(t));
  const unrecognized = allTypes.filter((t) => !KNOWN_TYPES.has(t));
  if (recognized.length) findings.push({ id: 'sd-types', category: 'structured-data', severity: 'info', title: `Recognized types: ${[...new Set(recognized)].slice(0, 5).join(', ')}`, explanation: `Found ${allTypes.length} @type declaration(s); ${recognized.length} match common Schema.org types checked locally.`, evidence: cleanEvidence([...new Set(allTypes)].join(', '), 220), recommendation: 'This is a local type-name check only — confirm rich-result eligibility in Google’s Rich Results Test.', limitation: 'SiteScope does not validate against the full Schema.org vocabulary or Google eligibility rules.' });
  if (unrecognized.length) findings.push({ id: 'sd-unrecognized', category: 'structured-data', severity: 'info', title: `${unrecognized.length} unrecognized @type value(s)`, explanation: 'Some @type values are not in the local common-type list. They may still be valid Schema.org types.', evidence: cleanEvidence([...new Set(unrecognized)].join(', '), 220), recommendation: 'Check spelling against schema.org docs.' });

  const idCounts = new Map<string, number>();
  blocks.forEach((b) => b.parsed && collectIds(b.parsed, idCounts));
  const dupes = [...idCounts.entries()].filter(([, c]) => c > 1);
  if (dupes.length) findings.push({ id: 'sd-dupe-id', category: 'structured-data', severity: 'warning', title: 'Duplicate @id values detected', explanation: 'The same @id appears more than once, which can confuse graph merging.', evidence: cleanEvidence(dupes.map(([id, c]) => `${id} (×${c})`).join('; '), 240), recommendation: 'Give each node a unique @id.' });

  return { blocks, findings };
}
