/** Technical summary: URL anatomy, DOM stats, HTTPS/mixed content, honest timing. */
import type { Finding, TechnicalInfo } from '../../types';
import { all, domDepth } from '../utils/dom';
import { maskQuery } from '../utils/url';

export function analyzeTechnical(doc: Document, pageUrl: string): { technical: TechnicalInfo; findings: Finding[] } {
  const findings: Finding[] = [];
  let u: URL | null = null;
  try {
    u = new URL(pageUrl);
  } catch {
    u = null;
  }
  const https = u ? u.protocol === 'https:' : false;
  const mixed: string[] = [];
  if (https) {
    const httpRefs = [
      ...Array.from(doc.querySelectorAll('img[src^="http:"], script[src^="http:"], link[href^="http:"]')),
    ].slice(0, 5).map((el) => el.tagName.toLowerCase() + ' → ' + (el.getAttribute('src') ?? el.getAttribute('href') ?? ''));
    mixed.push(...httpRefs);
  }

  const elements = (() => {
    try {
      return doc.getElementsByTagName('*').length;
    } catch {
      return 0;
    }
  })();

  const timing: Record<string, number | null> = { domContentLoaded: null, load: null, firstPaint: null };
  try {
    const nav = (performance as Performance | undefined)?.getEntriesByType?.('navigation')?.[0] as PerformanceNavigationTiming | undefined;
    if (nav) {
      timing.domContentLoaded = Math.round(nav.domContentLoadedEventEnd);
      timing.load = Math.round(nav.loadEventEnd);
    }
    const paints = (performance as Performance | undefined)?.getEntriesByType?.('paint') ?? [];
    const fp = (paints as PerformanceEntry[]).find((p) => p.name === 'first-paint');
    if (fp) timing.firstPaint = Math.round(fp.startTime);
  } catch {
    /* timing stays null — reported honestly */
  }

  const technical: TechnicalInfo = {
    url: pageUrl,
    origin: u?.origin ?? '',
    protocol: u?.protocol ?? '',
    hostname: u?.hostname ?? '',
    path: u?.pathname ?? '',
    queryMasked: u ? maskQuery(pageUrl) : '',
    language: doc.documentElement?.getAttribute('lang'),
    charset: doc.querySelector('meta[charset]')?.getAttribute('charset') ?? doc.characterSet ?? null,
    viewport: doc.querySelector('meta[name="viewport" i]')?.getAttribute('content') ?? null,
    https,
    mixedContent: mixed,
    counts: {
      elements,
      domDepth: domDepth(doc),
      images: all(doc, 'img').length,
      links: all(doc, 'a').length,
      scripts: all(doc, 'script').length,
      stylesheets: all(doc, 'link[rel~="stylesheet" i]').length,
      headings: all(doc, 'h1,h2,h3,h4,h5,h6').length,
    },
    timing,
  };

  if (u && u.protocol === 'http:') {
    findings.push({ id: 'tech-http', category: 'technical', severity: 'critical', title: 'Page served over insecure HTTP', explanation: `URL scheme is http:// for ${u.hostname}. Credentials and content can be observed or modified in transit.`, evidence: u.origin, recommendation: 'Serve the page over HTTPS and redirect HTTP → HTTPS.' });
  } else if (https) {
    findings.push({ id: 'tech-https', category: 'technical', severity: 'passed', title: 'Page served over HTTPS', explanation: `Origin ${u?.origin} uses TLS. Certificate validity itself was not checked.`, recommendation: 'No action needed.' });
  }
  if (mixed.length) {
    findings.push({ id: 'tech-mixed', category: 'technical', severity: 'warning', title: `${mixed.length} potential mixed-content reference(s)`, explanation: 'HTTP subresources on an HTTPS page may be blocked by the browser.', evidence: mixed.join('; ').slice(0, 260), recommendation: 'Serve all subresources over HTTPS.' });
  }
  if (elements > 3000) {
    findings.push({ id: 'tech-dom-large', category: 'technical', severity: 'info', title: `Large DOM (${elements.toLocaleString()} elements, depth ${technical.counts.domDepth})`, explanation: 'Very large DOMs can slow rendering and interaction. Thresholds are heuristic.', evidence: `${elements} elements, depth ${technical.counts.domDepth}`, recommendation: 'Reduce DOM size where practical; measure with DevTools Performance, not DOM counts alone.' });
  }
  findings.push({
    id: 'tech-perf-limit',
    category: 'technical',
    severity: 'info',
    title: 'Performance timing is partial by design',
    explanation: 'Only Navigation/ Paint timings exposed to this context are reported. DOM counts cannot replace a Lighthouse trace or Core Web Vitals field data.',
    recommendation: 'Use PageSpeed Insights / Lighthouse for LCP, INP, CLS and TTFB. SiteScope never invents those scores.',
    limitation: 'No LCP/INP/CLS/TTFB/Lighthouse scores are fabricated.',
  });

  return { technical, findings };
}
