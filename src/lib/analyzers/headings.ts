/** Headings analyzer: order-preserving H1–H6 extraction + hierarchy checks. */
import type { Finding, HeadingItem } from '../../types';
import { all, textOf } from '../utils/dom';
import { cleanEvidence } from '../utils/sanitize';

export function analyzeHeadings(doc: Document): { headings: HeadingItem[]; counts: Record<string, number>; findings: Finding[] } {
  const els = all(doc, 'h1, h2, h3, h4, h5, h6');
  const headings: HeadingItem[] = els.map((el, i) => {
    const level = Number(el.tagName.substring(1)) || 1;
    const text = textOf(el, 200);
    return { level, text, order: i + 1, empty: text === '' };
  });
  const counts: Record<string, number> = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
  headings.forEach((h) => {
    counts[`h${h.level}`] = (counts[`h${h.level}`] ?? 0) + 1;
  });
  const findings: Finding[] = [];
  if (headings.length === 0) {
    findings.push({ id: 'headings-none', category: 'headings', severity: 'warning', title: 'No headings found', explanation: 'The page contains no H1–H6 elements. Headings structure content for readers and assistive tech.', evidence: '0 heading elements.', recommendation: 'Add a descriptive H1 and sub-headings that outline the page.' });
    return { headings, counts, findings };
  }
  const h1 = counts.h1 ?? 0;
  if (h1 === 0) findings.push({ id: 'headings-no-h1', category: 'headings', severity: 'warning', title: 'No H1 heading', explanation: 'No H1 was found. A single descriptive H1 helps define the page topic.', evidence: `h1:0 h2:${counts.h2} h3:${counts.h3}`, recommendation: 'Add one H1 describing the page’s main topic.' });
  else if (h1 > 1) findings.push({ id: 'headings-multi-h1', category: 'headings', severity: 'info', title: `Multiple H1 elements (${h1})`, explanation: 'Multiple H1s were found. HTML allows this (e.g. article sections), but a single clear H1 is usually simpler to maintain.', evidence: `h1 count: ${h1}`, recommendation: 'Review whether each H1 starts a genuinely independent section; otherwise consolidate.', limitation: 'Multiple H1s are an informational heuristic, not an automatic error.' });

  const empties = headings.filter((h) => h.empty);
  if (empties.length) findings.push({ id: 'headings-empty', category: 'headings', severity: 'warning', title: `${empties.length} empty heading(s)`, explanation: 'Empty headings add noise for screen readers and outline algorithms.', evidence: cleanEvidence(empties.map((e) => `H${e.level} #${e.order}`).join(', '), 200), recommendation: 'Remove empty headings or fill them with descriptive text.' });

  // Skipped levels: e.g. H1 -> H3 without H2
  const skips: string[] = [];
  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1].level;
    const cur = headings[i].level;
    if (cur > prev + 1) skips.push(`H${prev} → H${cur} at #${headings[i].order}`);
  }
  // Also H1 missing then starting at H2+
  if (headings.length && headings[0].level > 1 && h1 === 0) skips.unshift(`starts at H${headings[0].level} without H1`);
  if (skips.length) findings.push({ id: 'headings-skipped', category: 'headings', severity: 'info', title: 'Skipped heading level(s)', explanation: 'Heading levels jump by more than one in places. This is a structural hint, not a ranking penalty.', evidence: cleanEvidence(skips.slice(0, 5).join('; '), 250), recommendation: 'Nest headings sequentially (H1 → H2 → H3) where the content hierarchy allows it.' });
  else findings.push({ id: 'headings-ok', category: 'headings', severity: 'passed', title: 'Heading hierarchy looks sequential', explanation: `Checked ${headings.length} headings in document order; no skipped levels detected.`, recommendation: 'No action needed.' });

  return { headings, counts, findings };
}
