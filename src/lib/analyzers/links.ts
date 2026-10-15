/** Link analyzer: classification, accessible names, rel/target, obvious malformation. Never fetches targets. */
import type { Finding, LinkInfo } from '../../types';
import { all, attr, textOf } from '../utils/dom';
import { cleanEvidence, truncate } from '../utils/sanitize';
import { safeResolve, sameOrigin } from '../utils/url';

function classify(href: string | null, pageUrl: string): LinkInfo['kind'] {
  if (href == null || href.trim() === '') return 'empty';
  const t = href.trim();
  if (t.startsWith('#')) return 'same-page';
  const lower = t.toLowerCase();
  if (lower.startsWith('mailto:')) return 'email';
  if (lower.startsWith('tel:') || lower.startsWith('sms:') || lower.startsWith('callto:')) return 'telephone';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(t)) {
    if (lower.startsWith('http://') || lower.startsWith('https://')) {
      const same = sameOrigin(safeResolve(t, pageUrl) ?? '', pageUrl);
      if (t.startsWith('#')) return 'same-page';
      return same === false ? 'external' : 'internal';
    }
    return 'other-protocol';
  }
  // Relative URL
  try {
    const resolved = safeResolve(t, pageUrl);
    if (!resolved) return 'empty';
    if (resolved.split('#')[0] === pageUrl.split('#')[0] && t.includes('#')) return 'same-page';
    return sameOrigin(resolved, pageUrl) === false ? 'external' : 'internal';
  } catch {
    return 'empty';
  }
}

export function analyzeLinks(doc: Document, pageUrl: string): { links: LinkInfo[]; findings: Finding[] } {
  const els = all(doc, 'a');
  const links: LinkInfo[] = els.map((a) => {
    const rawHref = a.hasAttribute('href') ? (attr(a, 'href') ?? '') : null;
    const kind = classify(rawHref, pageUrl);
    const resolvedUrl = rawHref != null && rawHref.trim() !== '' ? safeResolve(rawHref, pageUrl) : null;
    const text = truncate(textOf(a, 120), 120);
    const aria = (attr(a, 'aria-label') ?? '').trim();
    const titleAttr = (attr(a, 'title') ?? '').trim();
    const hasImage = a.querySelector('img, svg') != null;
    const imgAlt = a.querySelector('img')?.getAttribute('alt')?.trim() ?? '';
    const accessibleName = aria || text || imgAlt || titleAttr || '';
    const rel = attr(a, 'rel');
    const relTokens = (rel ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    const malformed = rawHref != null && rawHref.trim() !== '' && resolvedUrl == null && kind !== 'email' && kind !== 'telephone' && kind !== 'other-protocol';
    return {
      href: rawHref,
      resolvedUrl,
      text,
      accessibleName: truncate(accessibleName, 140),
      kind,
      internal: kind === 'internal' ? true : kind === 'external' ? false : null,
      rel,
      relTokens,
      target: attr(a, 'target'),
      hasImage,
      emptyText: accessibleName.trim() === '',
      malformed,
    };
  });

  const findings: Finding[] = [];
  if (links.length === 0) {
    findings.push({ id: 'links-none', category: 'links', severity: 'info', title: 'No links found', explanation: 'No <a> elements were found on the page.', evidence: '0 <a> elements.', recommendation: 'No action needed unless navigation was expected.' });
    return { links, findings };
  }
  const empty = links.filter((l) => l.kind === 'empty');
  const noName = links.filter((l) => l.emptyText && l.kind !== 'empty');
  const malformed = links.filter((l) => l.malformed);
  const blankNoNoop = links.filter((l) => (l.target ?? '').toLowerCase() === '_blank' && !(l.relTokens.includes('noopener') || l.relTokens.includes('noreferrer')));
  const counts = (k: LinkInfo['kind']) => links.filter((l) => l.kind === k).length;

  if (empty.length) findings.push({ id: 'links-empty', category: 'links', severity: 'warning', title: `${empty.length} empty link(s)`, explanation: 'Links with missing or empty href attributes go nowhere and confuse keyboard users.', evidence: `${empty.length} of ${links.length} links lack a usable href.`, recommendation: 'Remove empty links or replace non-navigating controls with <button>.' });
  if (noName.length) findings.push({ id: 'links-noname', category: 'links', severity: 'warning', title: `${noName.length} link(s) without accessible names`, explanation: 'Links with no text, aria-label, or image alt are announced as “link” with no context.', evidence: cleanEvidence(noName.slice(0, 3).map((l) => l.resolvedUrl ?? l.href ?? '(no href)').join('; '), 260), recommendation: 'Give every link visible text or an aria-label; don’t rely on title alone.' });
  if (malformed.length) findings.push({ id: 'links-malformed', category: 'links', severity: 'warning', title: `${malformed.length} obviously malformed destination(s)`, explanation: 'These href values could not be parsed as URLs (e.g. stray spaces, bad encoding).', evidence: cleanEvidence(malformed.slice(0, 3).map((l) => String(l.href)).join('; '), 260), recommendation: 'Fix or remove the malformed href values. This check is syntactic only — targets were not fetched.' });
  if (blankNoNoop.length) findings.push({ id: 'links-blank-rel', category: 'links', severity: 'info', title: `${blankNoNoop.length} _blank link(s) without rel protection`, explanation: 'target=_blank without rel=noopener lets the new page access window.opener.', evidence: `${blankNoNoop.length} link(s) use target=_blank without noopener/noreferrer.`, recommendation: 'Add rel="noopener" (and noreferrer if referrer must be hidden) to _blank links.' });
  if (!empty.length && !noName.length && !malformed.length) findings.push({ id: 'links-ok', category: 'links', severity: 'passed', title: `Link basics look healthy (${links.length} links)`, explanation: `Checked ${links.length} links: internal ${counts('internal')}, external ${counts('external')}, same-page ${counts('same-page')}. Targets were not fetched, so “broken” status is unknown.`, recommendation: 'No action needed. Use the manual reachability check for spot-checking important targets.', limitation: 'SiteScope never labels a link “broken” without fetching; reachability testing is explicit and manual-only.' });

  return { links, findings };
}
