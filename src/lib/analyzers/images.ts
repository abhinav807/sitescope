/** Image auditor: <img> + reliable background-image detection. No auto-downloads. */
import type { AnalyzerThresholds, Finding, ImageInfo } from '../../types';
import { all, attr, guessImageFormat } from '../utils/dom';
import { cleanEvidence } from '../utils/sanitize';
import { safeResolve } from '../utils/url';

function imgState(img: HTMLImageElement): { broken: boolean; naturalWidth: number | null; naturalHeight: number | null } {
  try {
    const complete = (img as HTMLImageElement).complete;
    const nw = (img as HTMLImageElement).naturalWidth ?? 0;
    return {
      broken: Boolean(complete && nw === 0 && (img.currentSrc || img.src)),
      naturalWidth: typeof nw === 'number' ? nw : null,
      naturalHeight: typeof (img as HTMLImageElement).naturalHeight === 'number' ? (img as HTMLImageElement).naturalHeight : null,
    };
  } catch {
    return { broken: false, naturalWidth: null, naturalHeight: null };
  }
}

export function analyzeImages(doc: Document, pageUrl: string, t: AnalyzerThresholds): { images: ImageInfo[]; findings: Finding[] } {
  const els = all(doc, 'img') as HTMLImageElement[];
  const images: ImageInfo[] = els.map((img) => {
    const rawSrc = attr(img, 'src') ?? attr(img, 'data-src') ?? '';
    const current = ((): string => {
      try {
        return (img.currentSrc || img.src || rawSrc || '').trim();
      } catch {
        return (rawSrc || '').trim();
      }
    })();
    const resolvedUrl = safeResolve(current || rawSrc, pageUrl) ?? (current || rawSrc || '');
    const hasAlt = img.hasAttribute('alt');
    const altRaw = hasAlt ? (attr(img, 'alt') ?? '') : null;
    const altState: ImageInfo['altState'] = !hasAlt ? 'missing' : (altRaw ?? '').trim() === '' ? 'empty-decorative' : 'ok';
    const st = imgState(img);
    let displayedWidth: number | null = null;
    let displayedHeight: number | null = null;
    try {
      const r = img.getBoundingClientRect?.();
      if (r) {
        displayedWidth = Math.round(r.width) || null;
        displayedHeight = Math.round(r.height) || null;
      }
    } catch {
      /* ignore */
    }
    const loading = attr(img, 'loading');
    return {
      src: current || rawSrc || '',
      resolvedUrl,
      alt: altRaw,
      altState,
      title: attr(img, 'title'),
      widthAttr: attr(img, 'width'),
      heightAttr: attr(img, 'height'),
      naturalWidth: st.naturalWidth,
      naturalHeight: st.naturalHeight,
      displayedWidth,
      displayedHeight,
      loading,
      decoding: attr(img, 'decoding'),
      fetchPriority: attr(img, 'fetchpriority'),
      srcset: attr(img, 'srcset'),
      sizes: attr(img, 'sizes'),
      format: guessImageFormat(current || rawSrc || ''),
      broken: st.broken,
      lazy: (loading ?? '').toLowerCase() === 'lazy',
    };
  });

  const findings: Finding[] = [];
  if (images.length === 0) {
    findings.push({ id: 'img-none', category: 'images', severity: 'info', title: 'No <img> elements found', explanation: 'The page exposes no <img> tags. Background-image-only designs were not counted as images.', evidence: '0 <img> elements.', recommendation: 'No action needed unless images were expected.' });
    return { images, findings };
  }
  const missing = images.filter((i) => i.altState === 'missing');
  const emptyDec = images.filter((i) => i.altState === 'empty-decorative');
  const broken = images.filter((i) => i.broken);
  const noDims = images.filter((i) => !i.widthAttr || !i.heightAttr);
  const large = images.filter((i) => (i.displayedWidth ?? 0) >= t.largeImageMinWidth || (i.naturalWidth ?? 0) >= t.largeImageMinWidth);

  if (missing.length) findings.push({ id: 'img-missing-alt', category: 'images', severity: 'warning', title: `${missing.length} image(s) missing alt text`, explanation: 'Images without any alt attribute are announced as unlabelled graphics by screen readers.', evidence: cleanEvidence(missing.slice(0, 3).map((m) => m.resolvedUrl).join('; '), 260), recommendation: 'Add descriptive alt text. Use alt="" (empty) only for purely decorative images.' });
  else findings.push({ id: 'img-alt-ok', category: 'images', severity: 'passed', title: 'All images have alt attributes', explanation: `All ${images.length} image(s) declare alt (empty alt is valid for decorative images).`, recommendation: 'No action needed.' });
  if (emptyDec.length && missing.length) findings.push({ id: 'img-decorative', category: 'images', severity: 'info', title: `${emptyDec.length} decorative image(s) with empty alt`, explanation: 'Empty alt (alt="") correctly hides decorative images from assistive tech. Verify each is truly decorative.', evidence: cleanEvidence(emptyDec.slice(0, 3).map((m) => m.resolvedUrl).join('; '), 260), recommendation: 'Keep alt="" for decorative images; give meaningful images descriptive text.' });
  if (broken.length) findings.push({ id: 'img-broken', category: 'images', severity: 'warning', title: `${broken.length} image(s) appear broken or unloaded`, explanation: 'These images report complete-but-zero-size, meaning the source failed or is still blocked.', evidence: cleanEvidence(broken.slice(0, 3).map((m) => m.resolvedUrl).join('; '), 260), recommendation: 'Check the src URLs, file existence, and any hotlink/referrer restrictions.' });
  if (noDims.length) findings.push({ id: 'img-no-dims', category: 'images', severity: 'info', title: `${noDims.length} image(s) missing width/height attributes`, explanation: 'Without intrinsic dimensions the browser cannot reserve layout space, risking layout shift.', evidence: `${noDims.length} of ${images.length} lack width/height attrs.`, recommendation: 'Add width and height attributes matching the intrinsic size; scale via CSS.' });
  if (large.length) findings.push({ id: 'img-large', category: 'images', severity: 'info', title: `${large.length} large rendered image(s)`, explanation: `Rendered or natural width ≥ ${t.largeImageMinWidth}px. File size and cache behavior cannot be inferred from the DOM alone.`, evidence: cleanEvidence(large.slice(0, 3).map((m) => `${m.resolvedUrl} (${m.displayedWidth ?? m.naturalWidth ?? '?'}px)`).join('; '), 260), recommendation: 'Serve responsive variants (srcset/sizes) and modern formats; verify weight in DevTools Network.', limitation: 'DOM inspection cannot measure bytes transferred or cache hits.' });

  return { images, findings };
}
