/** Export helpers: JSON / CSV / printable HTML. All local, correctly escaped. */
import type { AnalysisResult } from '../types';
import { escapeCsvCell, escapeHtml } from './utils/sanitize';
import { exportFilename, maskQuery } from './utils/url';

export function analysisToJson(result: AnalysisResult): string {
  return JSON.stringify(result, null, 2);
}

export function linksToCsv(result: AnalysisResult): string {
  const head = ['text', 'url', 'kind', 'rel', 'target', 'accessible_name'];
  const rows = result.links.map((l) =>
    [l.text, l.resolvedUrl ?? l.href ?? '', l.kind, l.rel ?? '', l.target ?? '', l.accessibleName]
      .map(escapeCsvCell)
      .join(','),
  );
  return [head.join(','), ...rows].join('\r\n');
}

export function imagesToCsv(result: AnalysisResult): string {
  const head = ['src', 'alt_state', 'alt', 'width_attr', 'height_attr', 'loading', 'format', 'broken'];
  const rows = result.images.map((i) =>
    [i.resolvedUrl, i.altState, i.alt ?? '', i.widthAttr ?? '', i.heightAttr ?? '', i.loading ?? '', i.format ?? '', i.broken ? 'yes' : 'no']
      .map(escapeCsvCell)
      .join(','),
  );
  return [head.join(','), ...rows].join('\r\n');
}

export function findingsToCsv(result: AnalysisResult): string {
  const head = ['severity', 'category', 'title', 'explanation', 'recommendation'];
  const rows = result.findings.map((f) =>
    [f.severity, f.category, f.title, f.explanation, f.recommendation].map(escapeCsvCell).join(','),
  );
  return [head.join(','), ...rows].join('\r\n');
}

export function reportToHtml(result: AnalysisResult): string {
  const masked = (() => {
    try {
      const u = new URL(result.pageUrl);
      return `${u.origin}${u.pathname}${maskQuery(result.pageUrl)}`;
    } catch {
      return result.pageUrl;
    }
  })();
  const sevBadge = (s: string) =>
    `<span class="badge badge-${escapeHtml(s)}">${escapeHtml(s)}</span>`;
  const rows = result.findings
    .map(
      (f) => `<section class="finding">
        <header>${sevBadge(f.severity)} <strong>${escapeHtml(f.title)}</strong> <span class="cat">${escapeHtml(f.category)}</span></header>
        <p>${escapeHtml(f.explanation)}</p>
        ${f.evidence ? `<pre>${escapeHtml(f.evidence)}</pre>` : ''}
        <p class="rec"><em>Recommendation:</em> ${escapeHtml(f.recommendation)}</p>
        ${f.limitation ? `<p class="lim"><em>Limitation:</em> ${escapeHtml(f.limitation)}</p>` : ''}
      </section>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>SiteScope report — ${escapeHtml(result.technical.hostname || 'page')}</title>
<style>
body{font-family:system-ui,sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem;color:#111}
header.report{border-bottom:2px solid #111;padding-bottom:1rem;margin-bottom:1rem}
.finding{border:1px solid #ccc;border-radius:8px;padding:.75rem 1rem;margin:.75rem 0}
pre{background:#f4f4f4;padding:.5rem;white-space:pre-wrap;word-break:break-word}
.badge{display:inline-block;padding:.1rem .5rem;border-radius:999px;font-size:.75rem;text-transform:uppercase;border:1px solid #999}
.badge-critical{background:#fde2e2}.badge-warning{background:#fff3cd}.badge-info{background:#e2f0fd}.badge-passed{background:#e2f5e2}
.cat{color:#666;font-size:.8rem}.rec{margin:.25rem 0}.lim{color:#555;font-size:.9rem}
@media print{.finding{break-inside:avoid}}
</style></head>
<body>
<header class="report">
<h1>SiteScope report</h1>
<p><strong>Page:</strong> ${escapeHtml(masked)}</p>
<p><strong>Title:</strong> ${escapeHtml(result.pageTitle)}</p>
<p><strong>Analyzed:</strong> ${escapeHtml(result.analyzedAt)}</p>
<p><strong>Summary:</strong> ${result.summary.critical} critical · ${result.summary.warning} warnings · ${result.summary.info} info · ${result.summary.passed} passed</p>
<p>Generated locally by SiteScope. Query parameters are masked by default. No data was uploaded.</p>
</header>
${rows || '<p>No findings.</p>'}
</body></html>`;
}

export function filenamesFor(host: string) {
  return {
    json: exportFilename(host, 'json'),
    linksCsv: exportFilename(host, 'links.csv'),
    imagesCsv: exportFilename(host, 'images.csv'),
    findingsCsv: exportFilename(host, 'findings.csv'),
    html: exportFilename(host, 'html'),
  };
}
