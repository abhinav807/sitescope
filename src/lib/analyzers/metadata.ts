/** Metadata analyzer: title, description, robots, canonical, lang, charset, viewport... */
import type { AnalyzerThresholds, Finding, MetaItem } from '../../types';
import { all, attr, textOf } from '../utils/dom';
import { cleanEvidence } from '../utils/sanitize';
import { safeResolve } from '../utils/url';

function item(
  key: string, rawValue: string, normalized: string, source: string,
  status: MetaItem['status'], note: string, recommendation?: string,
): MetaItem {
  return { key, rawValue: cleanEvidence(rawValue, 300), normalized: cleanEvidence(normalized, 300), source, status, note, recommendation };
}

export function analyzeMetadata(
  doc: Document, pageUrl: string, t: AnalyzerThresholds,
): { items: MetaItem[]; findings: Finding[] } {
  const items: MetaItem[] = [];
  const findings: Finding[] = [];
  const push = (f: Finding) => findings.push(f);

  const titleEls = all(doc, 'title');
  const titleText = titleEls.length ? textOf(titleEls[0]) : '';
  if (titleEls.length === 0 || titleText === '') {
    items.push(item('title', '', '(missing)', 'document.title', 'critical', 'No <title> element with text was found.'));
    push({ id: 'meta-missing-title', category: 'metadata', severity: 'critical', title: 'Missing page title', explanation: 'The document has no usable <title>. Tabs, bookmarks and search results will show a URL instead of a name.', evidence: `Found ${titleEls.length} <title> element(s).`, recommendation: 'Add exactly one descriptive <title> element inside <head>.' });
  } else {
    const len = titleText.length;
    let status: MetaItem['status'] = 'passed';
    let note = `${len} characters. Within the ${t.titleMin}–${t.titleMax} heuristic range.`;
    if (titleEls.length > 1) {
      status = 'warning';
      note = `${len} characters, but ${titleEls.length} <title> elements were found; browsers use the first.`;
      push({ id: 'meta-duplicate-title', category: 'metadata', severity: 'warning', title: 'Duplicate <title> elements', explanation: `Found ${titleEls.length} <title> elements. Only the first is used; extras indicate a templating bug.`, evidence: cleanEvidence(titleText, 200), recommendation: 'Keep exactly one <title> element.' });
    } else if (len < t.titleMin || len > t.titleMax) {
      status = 'warning';
      note = `${len} characters — outside the ${t.titleMin}–${t.titleMax} heuristic range (display may be truncated). This is a heuristic, not a ranking penalty.`;
      push({ id: 'meta-title-length', category: 'metadata', severity: 'warning', title: len < t.titleMin ? 'Title is unusually short' : 'Title is unusually long', explanation: `Title length is ${len} characters (heuristic range ${t.titleMin}–${t.titleMax}). Search engines may truncate long titles.`, evidence: cleanEvidence(titleText, 200), recommendation: 'Aim for a concise, unique title in the heuristic range. Limits are configurable in Settings.' });
    }
    items.push(item('title', titleText, `${len} chars`, '<title>', status, note, status === 'passed' ? undefined : 'Review the title for uniqueness and length.'));
  }

  const descMetas = all(doc, 'meta[name="description" i]');
  if (descMetas.length === 0) {
    items.push(item('meta:description', '', '(missing)', 'meta[name=description]', 'warning', 'No meta description found.'));
    push({ id: 'meta-missing-description', category: 'metadata', severity: 'warning', title: 'Missing meta description', explanation: 'No meta[name=description] was found. Search engines may generate their own snippet.', evidence: '0 meta[name=description] elements.', recommendation: 'Add a unique meta description summarizing the page.' });
  } else {
    const raw = (attr(descMetas[0], 'content') ?? '').trim();
    if (descMetas.length > 1) {
      items.push(item('meta:description', raw, `${raw.length} chars (${descMetas.length} tags)`, 'meta[name=description][0]', 'warning', `Duplicate meta descriptions: ${descMetas.length} tags found; first is typically used.`));
      push({ id: 'meta-duplicate-description', category: 'metadata', severity: 'warning', title: 'Duplicate meta descriptions', explanation: `Found ${descMetas.length} meta descriptions.`, evidence: cleanEvidence(raw, 200), recommendation: 'Keep exactly one meta description.' });
    } else if (raw === '') {
      items.push(item('meta:description', '', '(empty)', 'meta[name=description]', 'warning', 'Meta description is present but empty.'));
      push({ id: 'meta-empty-description', category: 'metadata', severity: 'warning', title: 'Empty meta description', explanation: 'The meta description tag has no content.', evidence: '(empty content attribute)', recommendation: 'Write a unique description or remove the empty tag.' });
    } else {
      const len = raw.length;
      const out = len < t.descriptionMin || len > t.descriptionMax;
      items.push(item('meta:description', raw, `${len} chars`, 'meta[name=description]', out ? 'warning' : 'passed', out ? `${len} characters — outside the ${t.descriptionMin}–${t.descriptionMax} heuristic range.` : `${len} characters. Within the heuristic range.`));
      if (out) push({ id: 'meta-description-length', category: 'metadata', severity: 'warning', title: len < t.descriptionMin ? 'Description is unusually short' : 'Description is unusually long', explanation: `Description is ${len} characters (heuristic ${t.descriptionMin}–${t.descriptionMax}).`, evidence: cleanEvidence(raw, 220), recommendation: 'Aim for the heuristic range. Limits are configurable in Settings.', limitation: 'Length heuristics describe display truncation risk, not a confirmed ranking factor.' });
    }
  }

  const robotsMeta = all(doc, 'meta[name="robots" i]');
  const robotsRaw = robotsMeta.map((m) => (attr(m, 'content') ?? '').toLowerCase());
  const robotsJoined = robotsRaw.join(', ');
  if (robotsMeta.length === 0) {
    items.push(item('meta:robots', '', '(not set — default: index, follow)', 'meta[name=robots]', 'passed', 'No meta robots tag. Default behavior allows indexing (this does not prove the page is indexed).'));
  } else {
    const blocking = /noindex|none/.test(robotsJoined);
    items.push(item('meta:robots', robotsJoined, robotsJoined, `meta[name=robots] ×${robotsMeta.length}`, blocking ? 'critical' : 'info', blocking ? 'Directives may prevent indexing. Verify this is intentional.' : 'Robots directives found; no noindex detected.'));
    if (blocking) push({ id: 'meta-robots-noindex', category: 'indexing', severity: 'critical', title: 'Robots directive may block indexing', explanation: `Meta robots contains "${robotsJoined}". “noindex”/“none” asks search engines not to index this page.`, evidence: cleanEvidence(robotsJoined, 200), recommendation: 'If the page should be indexed, remove noindex. If intentional (e.g. staging, thank-you page), keep it.' });
    if (robotsMeta.length > 1) push({ id: 'meta-robots-duplicate', category: 'metadata', severity: 'warning', title: 'Multiple meta robots tags', explanation: `Found ${robotsMeta.length} meta robots tags; conflicting directives can confuse crawlers.`, evidence: cleanEvidence(robotsJoined, 200), recommendation: 'Consolidate into a single meta robots tag.' });
  }

  const canonicals = all(doc, 'link[rel~="canonical" i]');
  if (canonicals.length === 0) {
    items.push(item('link:canonical', '', '(missing)', 'link[rel=canonical]', 'warning', 'No canonical URL declared.'));
    push({ id: 'meta-missing-canonical', category: 'metadata', severity: 'warning', title: 'Missing canonical URL', explanation: 'No link[rel=canonical] was found. Search engines will choose a canonical themselves.', evidence: '0 link[rel=canonical] elements.', recommendation: 'Add an absolute canonical URL pointing at the preferred version of this page.' });
  } else {
    const href = attr(canonicals[0], 'href') ?? '';
    const resolved = safeResolve(href, pageUrl);
    if (canonicals.length > 1) {
      items.push(item('link:canonical', href, resolved ?? '(unresolvable)', 'link[rel=canonical][0]', 'warning', `${canonicals.length} canonical tags found; only one should exist.`));
      push({ id: 'meta-duplicate-canonical', category: 'metadata', severity: 'warning', title: 'Multiple canonical tags', explanation: `Found ${canonicals.length} canonical links.`, evidence: cleanEvidence(href, 200), recommendation: 'Keep exactly one canonical link.' });
    } else if (!href.trim() || !resolved) {
      items.push(item('link:canonical', href, '(invalid)', 'link[rel=canonical]', 'critical', 'Canonical href is empty, relative-unresolvable, or malformed.'));
      push({ id: 'meta-invalid-canonical', category: 'metadata', severity: 'critical', title: 'Invalid canonical URL', explanation: 'The canonical href could not be resolved to an absolute URL.', evidence: cleanEvidence(href || '(empty)', 200), recommendation: 'Use a complete absolute URL (https://…) as the canonical.' });
    } else {
      const isHttp = /^https?:\/\//i.test(resolved);
      items.push(item('link:canonical', href, resolved, 'link[rel=canonical]', isHttp ? 'passed' : 'warning', isHttp ? 'Canonical resolves to an absolute HTTP(S) URL.' : 'Canonical does not use an absolute HTTP(S) URL.'));
      if (!isHttp) push({ id: 'meta-canonical-relative', category: 'metadata', severity: 'warning', title: 'Canonical is not absolute', explanation: `Canonical resolves to "${resolved}", which is not an absolute HTTP(S) URL.`, evidence: cleanEvidence(href, 200), recommendation: 'Use an absolute canonical URL.' });
    }
  }

  const htmlEl = doc.documentElement;
  const lang = htmlEl?.getAttribute('lang')?.trim() ?? '';
  items.push(item('html:lang', lang || '', lang || '(missing)', '<html lang>', lang ? 'passed' : 'warning', lang ? `Document language: ${lang}.` : 'No lang attribute on <html>. Screen readers and search engines use it.'));
  if (!lang) push({ id: 'meta-missing-lang', category: 'metadata', severity: 'warning', title: 'Missing document language', explanation: 'The <html> element has no lang attribute.', evidence: '<html> without lang', recommendation: 'Set lang to the page language, e.g. <html lang="en">.' });

  const charsetMeta = doc.querySelector('meta[charset], meta[http-equiv="Content-Type" i]');
  const charset = charsetMeta ? ((charsetMeta.getAttribute('charset') ?? charsetMeta.getAttribute('content') ?? '').trim()) : '';
  items.push(item('meta:charset', charset || '', charset || '(missing)', charsetMeta ? '<meta charset>' : 'meta[charset]', charset ? 'passed' : 'warning', charset ? `Character encoding: ${charset}.` : 'No character-encoding declaration found.'));
  if (!charset) push({ id: 'meta-missing-charset', category: 'metadata', severity: 'warning', title: 'Missing charset declaration', explanation: 'No <meta charset> was found; the browser falls back to heuristics.', evidence: '0 charset declarations.', recommendation: 'Add <meta charset="utf-8"> as the first element in <head>.' });

  const vp = doc.querySelector('meta[name="viewport" i]');
  const vpContent = vp ? (vp.getAttribute('content') ?? '').trim() : '';
  items.push(item('meta:viewport', vpContent || '', vpContent || '(missing)', 'meta[name=viewport]', vpContent ? 'passed' : 'warning', vpContent ? 'Viewport declaration present (required for responsive rendering).' : 'No viewport meta tag; mobile rendering may be broken.'));
  if (!vpContent) push({ id: 'meta-missing-viewport', category: 'metadata', severity: 'warning', title: 'Missing viewport declaration', explanation: 'No meta[name=viewport] was found.', evidence: '0 viewport tags.', recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.' });

  const theme = doc.querySelector('meta[name="theme-color" i]');
  items.push(item('meta:theme-color', theme ? (theme.getAttribute('content') ?? '') : '', theme ? (theme.getAttribute('content') ?? '') : '(not set)', 'meta[name=theme-color]', 'info', theme ? 'Theme color declared.' : 'Optional: no theme-color declared.'));

  const author = doc.querySelector('meta[name="author" i]');
  items.push(item('meta:author', author ? (author.getAttribute('content') ?? '') : '', author ? (author.getAttribute('content') ?? '') : '(not set)', 'meta[name=author]', 'info', author ? 'Author metadata present.' : 'Optional: no author metadata.'));

  return { items, findings };
}
