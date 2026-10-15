/** Engine: runs every analyzer on a Document and aggregates the summary. Pure + testable. */
import type { AnalysisResult, AnalyzerThresholds, Finding } from '../../types';
import { DEFAULT_THRESHOLDS } from '../../types';
import { analyzeMetadata } from './metadata';
import { analyzeHeadings } from './headings';
import { analyzeSocial } from './social';
import { analyzeStructuredData } from './structuredData';
import { analyzeImages } from './images';
import { analyzeLinks } from './links';
import { analyzeIndexing } from './indexing';
import { analyzeFavicon } from './favicon';
import { analyzeTechnical } from './technical';

export function analyzeDocument(
  doc: Document,
  pageUrl: string,
  thresholds: AnalyzerThresholds = DEFAULT_THRESHOLDS,
): AnalysisResult {
  const title = (() => {
    try {
      return (doc.title ?? '').trim() || doc.querySelector('title')?.textContent?.trim() || '(no title)';
    } catch {
      return '(no title)';
    }
  })();

  const meta = analyzeMetadata(doc, pageUrl, thresholds);
  const hd = analyzeHeadings(doc);
  const social = analyzeSocial(doc, pageUrl);
  const sd = analyzeStructuredData(doc);
  const imgs = analyzeImages(doc, pageUrl, thresholds);
  const links = analyzeLinks(doc, pageUrl);
  const idx = analyzeIndexing(doc, pageUrl);
  const fav = analyzeFavicon(doc, pageUrl);
  const tech = analyzeTechnical(doc, pageUrl);

  const findings: Finding[] = [
    ...meta.findings,
    ...hd.findings,
    ...social.findings,
    ...sd.findings,
    ...imgs.findings,
    ...links.findings,
    ...idx.findings,
    ...fav.findings,
    ...tech.findings,
  ];

  const summary = {
    critical: findings.filter((f) => f.severity === 'critical').length,
    warning: findings.filter((f) => f.severity === 'warning').length,
    info: findings.filter((f) => f.severity === 'info').length,
    passed: findings.filter((f) => f.severity === 'passed').length,
    total: findings.length,
  };

  return {
    pageUrl,
    pageTitle: title,
    analyzedAt: new Date().toISOString(),
    capabilities: {
      dom: true,
      headersAvailable: false,
      robotsTxt: 'needs-permission',
      httpReachability: 'manual-only',
    },
    meta: meta.items,
    headings: hd.headings,
    headingCounts: hd.counts,
    social: { og: social.og, twitter: social.twitter, mismatches: [] },
    jsonLd: sd.blocks,
    images: imgs.images,
    links: links.links,
    favicons: fav.favicons,
    manifest: fav.manifest,
    technical: tech.technical,
    findings,
    summary,
  };
}

/** Filter helper used by UI + tests. */
export function filterFindings(findings: Finding[], severity: string, query: string): Finding[] {
  const q = query.trim().toLowerCase();
  return findings.filter((f) => {
    if (severity !== 'all' && f.severity !== severity) return false;
    if (!q) return true;
    return `${f.title} ${f.explanation} ${f.category} ${f.id}`.toLowerCase().includes(q);
  });
}
