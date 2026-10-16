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
  const s = neutralizeCsvFormula(v == null ? '' : String(v));
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Spreadsheet formula-injection mitigation (OWASP-recommended approach).
 *
 * Cells whose first character is `=`, `+`, `-`, or `@` (or tab/CR, which some
 * parsers treat as formula continuations) are prefixed with a single quote.
 * Spreadsheet apps treat the leading `'` as a text marker: it is not displayed
 * and the cell renders as plain text instead of executing.
 *
 * Scope and limits (do NOT assume universal safety):
 * - Only the FIRST character is inspected; ordinary values (including `=` or
 *   `-` mid-string, numbers, empty strings) pass through byte-identical.
 * - Behavior varies by application/version (Excel vs. Sheets vs. LibreOffice);
 *   this is a mitigation, not a proof against every spreadsheet quirk.
 * - Applies to CSV exports only; JSON/HTML paths are unaffected.
 */
export function neutralizeCsvFormula(s: string): string {
  if (s.length === 0) return s;
  const first = s.charAt(0);
  if (first === '=' || first === '+' || first === '-' || first === '@' || first === '\t' || first === '\r') {
    return `'${s}`;
  }
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
