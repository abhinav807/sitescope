/** Open Graph / Twitter card analyzer with real-value preview (no render claims). */
import type { Finding } from '../../types';
import { all, attr } from '../utils/dom';
import { cleanEvidence } from '../utils/sanitize';
import { safeResolve } from '../utils/url';

function collect(doc: Document, attrName: 'property' | 'name', prefix: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of all(doc, `meta[${attrName}^="${prefix}" i]`)) {
    const k = (attr(m, attrName) ?? '').toLowerCase();
    const v = (attr(m, 'content') ?? '').trim();
    if (k && !(k in out)) out[k] = v;
    else if (k && !out[k] && v) out[k] = v;
  }
  return out;
}

export function analyzeSocial(doc: Document, pageUrl: string): { og: Record<string, string>; twitter: Record<string, string>; findings: Finding[] } {
  const og = collect(doc, 'property', 'og:');
  // Some sites use name="og:*" — merge those too
  const ogName = collect(doc, 'name', 'og:');
  for (const [k, v] of Object.entries(ogName)) if (!og[k]) og[k] = v;
  const twitter = collect(doc, 'name', 'twitter:');
  const findings: Finding[] = [];

  const req = ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'];
  const missing = req.filter((k) => !og[k]);
  if (missing.length === 0) {
    findings.push({ id: 'social-og-complete', category: 'social', severity: 'passed', title: 'Core Open Graph tags present', explanation: 'og:title, og:description, og:image, og:url and og:type were all found.', recommendation: 'No action needed.' });
  } else {
    findings.push({ id: 'social-og-missing', category: 'social', severity: missing.includes('og:title') || missing.includes('og:image') ? 'warning' : 'info', title: `Missing Open Graph tags: ${missing.join(', ')}`, explanation: 'Some core Open Graph tags are absent. Shares may fall back to generic snippets.', evidence: cleanEvidence(`present: ${Object.keys(og).join(', ') || '(none)'}`, 220), recommendation: 'Add the missing og:* tags. og:image should be an absolute URL to a sufficiently large image.' });
  }

  if (!twitter['twitter:card'] && !twitter['twitter:title']) {
    findings.push({ id: 'social-twitter-missing', category: 'social', severity: 'info', title: 'No Twitter/X card metadata', explanation: 'No twitter:card metadata was found. X will fall back to Open Graph tags.', evidence: '0 twitter:* tags.', recommendation: 'Optionally add twitter:card (e.g. summary_large_image) plus twitter:title/description/image.' });
  } else {
    findings.push({ id: 'social-twitter-present', category: 'social', severity: 'passed', title: 'Twitter/X card metadata present', explanation: `Found ${Object.keys(twitter).length} twitter:* tag(s).`, recommendation: 'No action needed.' });
  }

  if (og['og:image']) {
    const resolved = safeResolve(og['og:image'], pageUrl);
    if (!resolved || !/^https?:\/\//i.test(resolved)) {
      findings.push({ id: 'social-og-image-invalid', category: 'social', severity: 'warning', title: 'og:image is not an absolute URL', explanation: 'Social crawlers require absolute image URLs.', evidence: cleanEvidence(og['og:image'], 200), recommendation: 'Use an absolute https:// URL for og:image.' });
    }
  }

  // Canonical / OG URL / page URL consistency
  const canon = doc.querySelector('link[rel~="canonical" i]')?.getAttribute('href') ?? null;
  const canonResolved = canon ? safeResolve(canon, pageUrl) : null;
  const ogUrlResolved = og['og:url'] ? safeResolve(og['og:url'], pageUrl) : null;
  if (canonResolved && ogUrlResolved && canonResolved !== ogUrlResolved) {
    findings.push({ id: 'social-url-mismatch', category: 'social', severity: 'info', title: 'Canonical and og:url differ', explanation: 'The canonical URL and og:url do not match. This can split share/index signals.', evidence: cleanEvidence(`canonical: ${canonResolved} | og:url: ${ogUrlResolved}`, 260), recommendation: 'Align canonical and og:url on the preferred absolute URL unless the difference is intentional.' });
  }
  if (ogUrlResolved && ogUrlResolved !== pageUrl.split('#')[0]) {
    // Only informational — pages legitimately differ (tracking params etc.)
    findings.push({ id: 'social-ogurl-differs', category: 'social', severity: 'info', title: 'og:url differs from the current URL', explanation: 'og:url points elsewhere. That is normal for canonicalized or parameterized pages.', evidence: cleanEvidence(`page: ${pageUrl.split('#')[0]} | og:url: ${ogUrlResolved}`, 260), recommendation: 'Verify the og:url is the intended share target.' });
  }

  return { og, twitter, findings };
}
