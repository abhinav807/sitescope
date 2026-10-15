/** Indexing checks: honest status labels (found / not-found / could-not-verify). */
import type { Finding } from '../../types';
import { safeResolve } from '../utils/url';
import { cleanEvidence } from '../utils/sanitize';

export type IndexStatus = 'found' | 'not-found' | 'could-not-verify' | 'not-applicable' | 'blocked';

export interface IndexingResult {
  rows: Array<{ check: string; status: IndexStatus; detail: string }>;
  findings: Finding[];
}

export function analyzeIndexing(doc: Document, pageUrl: string): IndexingResult {
  const rows: IndexingResult['rows'] = [];
  const findings: Finding[] = [];

  const robotsMeta = (doc.querySelector('meta[name="robots" i]')?.getAttribute('content') ?? '').toLowerCase();
  const hasNoindex = /noindex|none/.test(robotsMeta);
  rows.push({
    check: 'Meta robots',
    status: robotsMeta ? 'found' : 'not-found',
    detail: robotsMeta ? `Directives: ${robotsMeta}` : 'No meta robots tag (default: indexable — does not prove indexed).',
  });
  if (hasNoindex) {
    findings.push({ id: 'idx-noindex', category: 'indexing', severity: 'critical', title: 'Page asks not to be indexed', explanation: `Meta robots contains "${robotsMeta}".`, evidence: cleanEvidence(robotsMeta, 200), recommendation: 'Remove noindex if this page should appear in search results.' });
  }

  const canonEl = doc.querySelector('link[rel~="canonical" i]');
  const canonHref = canonEl?.getAttribute('href') ?? null;
  const canonResolved = canonHref ? safeResolve(canonHref, pageUrl) : null;
  rows.push({
    check: 'Canonical URL',
    status: !canonHref ? 'not-found' : canonResolved ? 'found' : 'blocked',
    detail: !canonHref ? 'No canonical declared.' : canonResolved ?? 'Canonical href is malformed.',
  });
  if (canonResolved && canonResolved.split('#')[0] !== pageUrl.split('#')[0]) {
    findings.push({ id: 'idx-canonical-differs', category: 'indexing', severity: 'info', title: 'Canonical points to a different URL', explanation: 'The canonical URL differs from the current URL. Index signals may consolidate there.', evidence: cleanEvidence(`page: ${pageUrl.split('#')[0]} | canonical: ${canonResolved}`, 280), recommendation: 'Confirm the canonical is the intended preferred URL.' });
  } else if (canonResolved) {
    findings.push({ id: 'idx-canonical-ok', category: 'indexing', severity: 'passed', title: 'Canonical is self-referential', explanation: 'The canonical URL matches the current page.', recommendation: 'No action needed.' });
  } else if (!canonHref) {
    findings.push({ id: 'idx-canonical-missing', category: 'indexing', severity: 'info', title: 'No canonical declared', explanation: 'Without a canonical, search engines choose one themselves.', evidence: '0 link[rel=canonical].', recommendation: 'Add a self-referencing absolute canonical in most cases.' });
  }

  rows.push({ check: 'X-Robots-Tag (HTTP header)', status: 'could-not-verify', detail: 'Response headers are not exposed to DOM inspection. Header checks require network-level access.' });
  rows.push({ check: 'HTTP status / redirects', status: 'could-not-verify', detail: 'The DOM does not reveal status codes or redirect chains. Use DevTools Network for the true status.' });
  rows.push({
    check: 'robots.txt & sitemaps',
    status: 'could-not-verify',
    detail: 'Fetching /robots.txt or sitemaps needs an explicit user action plus optional host permission; nothing is fetched automatically.',
  });
  findings.push({
    id: 'idx-headers-limit',
    category: 'indexing',
    severity: 'info',
    title: 'Header and crawl state could not be verified from the DOM',
    explanation: 'X-Robots-Tag, HTTP status, and redirect chains are invisible to DOM inspection. SiteScope reports “could not verify” rather than guessing.',
    recommendation: 'Use the Indexing tab’s optional “Check robots.txt” action (requests narrow host permission), plus DevTools Network and Search Console for ground truth.',
    limitation: 'A missing meta robots tag never means “blocked”, and an accessible page is never proof of Google indexation.',
  });

  // Fragment-only internal links hint (crawl-depth hint, not an error)
  const fragLinks = Array.from(doc.querySelectorAll('a[href^="#"]')).length;
  if (fragLinks > 0) {
    rows.push({ check: 'Same-page anchors', status: 'found', detail: `${fragLinks} link(s) point to #fragments on this page.` });
  }

  const nextPrev = doc.querySelector('link[rel="next" i], link[rel="prev" i], a[rel="next" i], a[rel="prev" i]');
  rows.push({ check: 'Pagination signals', status: nextPrev ? 'found' : 'not-applicable', detail: nextPrev ? 'next/prev link signals present.' : 'No next/prev pagination signals detected.' });

  return { rows, findings };
}
