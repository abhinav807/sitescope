/** Read-only DOM helpers shared by analyzers. Never writes to the page. */

export function all<T extends Element>(doc: Document, selector: string): T[] {
  try {
    return Array.from(doc.querySelectorAll<T>(selector));
  } catch {
    return [];
  }
}

export function attr(el: Element, name: string): string | null {
  try {
    const v = el.getAttribute(name);
    return v;
  } catch {
    return null;
  }
}

export function textOf(el: Element, max = 300): string {
  try {
    const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  } catch {
    return '';
  }
}

/** Approximate DOM depth via iterative traversal (bounded for very large pages). */
export function domDepth(doc: Document, limit = 200000): number {
  let max = 0;
  let visited = 0;
  const root = doc.documentElement;
  if (!root) return 0;
  const stack: Array<{ el: Element; d: number }> = [{ el: root, d: 1 }];
  while (stack.length && visited < limit) {
    const { el, d } = stack.pop()!;
    visited++;
    if (d > max) max = d;
    const kids = el.children;
    for (let i = 0; i < kids.length; i++) stack.push({ el: kids[i], d: d + 1 });
  }
  return max;
}

export function guessImageFormat(src: string): string | null {
  const m = src.split('?')[0].split('#')[0].match(/\.([a-zA-Z0-9]{2,5})$/);
  if (!m) {
    if (src.startsWith('data:image/svg')) return 'svg';
    if (src.startsWith('data:image/')) {
      const t = src.slice(11, 20).split(/[;,]/)[0];
      return t || null;
    }
    return null;
  }
  const ext = m[1].toLowerCase();
  const known = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'ico', 'bmp', 'tif', 'tiff']);
  return known.has(ext) ? (ext === 'jpg' ? 'jpeg' : ext) : ext;
}
