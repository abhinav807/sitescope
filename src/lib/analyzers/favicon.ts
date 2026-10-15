/** Favicon + PWA manifest-link inspector (markup only; resources not fetched by default). */
import type { FaviconInfo, Finding, ManifestInfo } from '../../types';
import { all, attr } from '../utils/dom';
import { cleanEvidence } from '../utils/sanitize';
import { safeResolve } from '../utils/url';

export function analyzeFavicon(doc: Document, pageUrl: string): { favicons: FaviconInfo[]; manifest: ManifestInfo; findings: Finding[] } {
  const findings: Finding[] = [];
  const linkEls = all(doc, 'link[rel*="icon" i], link[rel="apple-touch-icon" i], link[rel="mask-icon" i], link[rel="shortcut icon" i]');
  const favicons: FaviconInfo[] = linkEls.map((l) => {
    const rel = (attr(l, 'rel') ?? '').toLowerCase();
    const href = attr(l, 'href') ?? '';
    return {
      rel,
      href,
      resolvedUrl: safeResolve(href, pageUrl) ?? href,
      sizes: attr(l, 'sizes'),
      type: attr(l, 'type'),
    };
  });

  const manifestEl = doc.querySelector('link[rel="manifest" i]');
  const manifestHref = manifestEl?.getAttribute('href') ?? null;
  const manifest: ManifestInfo = {
    href: manifestHref,
    resolvedUrl: manifestHref ? (safeResolve(manifestHref, pageUrl) ?? manifestHref) : null,
    accessible: manifestHref ? 'could-not-verify' : 'not-found',
    fields: manifestHref ? {} : {},
    note: manifestHref
      ? 'Manifest link found. Contents are not fetched automatically; use the linked URL to inspect fields (name, icons, start_url, display…).'
      : 'No web app manifest link found.',
  };

  if (favicons.length === 0) {
    findings.push({ id: 'fav-none', category: 'favicon', severity: 'warning', title: 'No favicon declarations found', explanation: 'No icon link elements were found. Browsers fall back to /favicon.ico, which may 404.', evidence: '0 icon links.', recommendation: 'Add <link rel="icon" …> (plus apple-touch-icon for iOS) pointing at real files.' });
  } else {
    findings.push({ id: 'fav-found', category: 'favicon', severity: 'passed', title: `${favicons.length} icon declaration(s) found`, explanation: `Declared: ${[...new Set(favicons.map((f) => f.rel))].join(', ')}. Presence of markup does not prove the files load.`, evidence: cleanEvidence(favicons.slice(0, 4).map((f) => `${f.rel} → ${f.resolvedUrl}`).join('; '), 300), recommendation: 'Verify each file loads (DevTools Network) and covers needed sizes.' });
    const noSizes = favicons.filter((f) => f.rel.includes('icon') && !f.sizes && !f.href.endsWith('.svg') && !f.href.startsWith('data:'));
    if (noSizes.length) findings.push({ id: 'fav-no-sizes', category: 'favicon', severity: 'info', title: 'Some icons omit sizes/type', explanation: 'Missing sizes/type is fine for SVG but ambiguous for raster icons.', evidence: cleanEvidence(noSizes.slice(0, 3).map((f) => f.resolvedUrl).join('; '), 240), recommendation: 'Declare sizes (e.g. 32x32, 180x180 for apple-touch-icon) and type for raster icons.' });
  }

  const apple = favicons.filter((f) => f.rel.includes('apple-touch-icon'));
  if (favicons.length > 0 && apple.length === 0) {
    findings.push({ id: 'fav-no-apple', category: 'favicon', severity: 'info', title: 'No Apple touch icon', explanation: 'iOS home-screen bookmarks use apple-touch-icon; without one iOS takes a screenshot.', evidence: '0 apple-touch-icon links.', recommendation: 'Optionally add a 180x180 apple-touch-icon.' });
  }

  if (!manifestHref) {
    findings.push({ id: 'fav-no-manifest', category: 'favicon', severity: 'info', title: 'No web app manifest linked', explanation: 'Without a manifest link the page cannot be evaluated as an installable PWA from markup alone.', evidence: '0 link[rel=manifest].', recommendation: 'Add a manifest only if installability is a goal; otherwise ignore.', limitation: 'One or two manifest fields never prove installability — full PWA checks need service workers, icons, start_url, display and HTTPS.' });
  } else {
    findings.push({ id: 'fav-manifest-link', category: 'favicon', severity: 'info', title: 'Web app manifest linked (not fetched)', explanation: `Manifest href: ${manifest.resolvedUrl}. Contents were not fetched automatically to avoid extra requests.`, evidence: cleanEvidence(manifest.resolvedUrl ?? '', 220), recommendation: 'Open the manifest URL to review name, icons, start_url, scope, display and theme_color.', limitation: 'SiteScope distinguishes “markup found” from “resource loads”.' });
  }

  // Microsoft tiles (optional, informational)
  const msTile = doc.querySelector('meta[name="msapplication-TileImage" i], meta[name="msapplication-config" i]');
  if (msTile) {
    findings.push({ id: 'fav-mstile', category: 'favicon', severity: 'info', title: 'Microsoft tile metadata present', explanation: 'msapplication tile tags were found (legacy Windows pinning).', recommendation: 'No action needed; keep only if Windows pinning matters.' });
  }

  return { favicons, manifest, findings };
}
