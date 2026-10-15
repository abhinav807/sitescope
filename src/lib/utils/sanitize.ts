/** Text sanitizing helpers. React escapes by default; these add defense-in-depth. */

export function truncate(s: string, max = 500): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

export function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Strip ASCII control chars that could break CSV/JSON display. */
export function cleanEvidence(s: string, max = 500): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  return truncate(cleanWhitespace(cleaned), max);
}

function cleanWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export function escapeCsvCell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
