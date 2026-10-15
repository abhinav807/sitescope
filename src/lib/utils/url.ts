/** URL helpers: resolve, classify, mask. No network calls. */

export function safeResolve(href: string | null | undefined, base: string): string | null {
  if (href == null) return null;
  const t = href.trim();
  if (t === '') return null;
  try {
    return new URL(t, base).toString();
  } catch {
    return null;
  }
}

export function isHttpUrl(u: string | null): boolean {
  if (!u) return false;
  try {
    const p = new URL(u).protocol;
    return p === 'http:' || p === 'https:';
  } catch {
    return false;
  }
}

const SENSITIVE_KEYS = new Set([
  'token', 'access_token', 'id_token', 'refresh_token', 'api_key', 'apikey',
  'key', 'secret', 'password', 'passwd', 'pwd', 'auth', 'authorization',
  'session', 'sessionid', 'sid', 'phpsessid', 'csrf', 'xsrf', 'code', 'state',
  'client_secret', 'email', 'username', 'user',
]);

export function maskQuery(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    if (!u.search) return u.search;
    const masked = new URLSearchParams();
    u.searchParams.forEach((v, k) => {
      masked.set(k, SENSITIVE_KEYS.has(k.toLowerCase()) ? '••••' : v);
    });
    const s = masked.toString();
    return s ? `?${s}` : '';
  } catch {
    return '';
  }
}

export function stripQueryForFilename(urlStr: string, includeQuery: boolean): string {
  try {
    const u = new URL(urlStr);
    void includeQuery;
    return u.hostname.replace(/[^a-z0-9.-]+/gi, '-').toLowerCase() || 'page';
  } catch {
    return 'page';
  }
}

export function exportFilename(host: string, ext: string, includeQueryWarning = false): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  const cleaned = (host || 'page').replace(/[^a-z0-9.-]+/gi, '-').toLowerCase().replace(/^[-.]+|[-.]+$/g, '').slice(0, 60) || 'page';
  void includeQueryWarning;
  return `sitescope-${cleaned}-${stamp}.${ext}`;
}

export function sameOrigin(a: string, b: string): boolean | null {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.origin === ub.origin;
  } catch {
    return null;
  }
}

/** Allow only safe schemes for rendering clickable links. */
const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:', 'ftp:']);
export function isSafeHref(href: string | null): boolean {
  if (href == null) return false;
  const t = href.trim();
  if (t === '' || t.startsWith('#')) return true;
  try {
    // Relative URLs are safe (resolve against dummy base)
    const u = new URL(t, 'https://sitescope.local/');
    if (t.startsWith('/') || t.startsWith('./') || t.startsWith('../') || !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(t)) return true;
    return SAFE_SCHEMES.has(u.protocol);
  } catch {
    return false;
  }
}
