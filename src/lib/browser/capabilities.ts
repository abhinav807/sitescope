/** Capability + unsupported-page detection. Pure functions for testability. */

export interface PageSupport {
  supported: boolean;
  reason?: string;
}

/** Schemes / hosts the extension cannot inspect (restricted browser URLs). */
export function checkPageSupport(urlStr: string | undefined | null): PageSupport {
  if (!urlStr) return { supported: false, reason: 'No active tab URL was available.' };
  let u: URL;
  try {
    u = new URL(urlStr);
  } catch {
    return { supported: false, reason: 'The current URL could not be parsed.' };
  }
  const proto = u.protocol.toLowerCase();
  if (proto === 'chrome:' || proto === 'edge:' || proto === 'opera:' || proto === 'brave:' || proto === 'vivaldi:')
    return { supported: false, reason: 'Browser internal pages cannot be inspected by extensions.' };
  if (proto === 'about:' || proto === 'chrome-search:' || proto === 'chrome-native:')
    return { supported: false, reason: 'This browser page is not accessible to extensions.' };
  if (proto === 'view-source:' || proto === 'devtools:')
    return { supported: false, reason: 'Developer-internal pages cannot be analyzed.' };
  if (u.hostname === 'chrome.google.com' && u.pathname.startsWith('/webstore'))
    return { supported: false, reason: 'The Chrome Web Store blocks content-script inspection.' };
  if (proto !== 'http:' && proto !== 'https:' && proto !== 'file:')
    return { supported: false, reason: `URLs with the “${proto}” scheme are not supported.` };
  // PDF viewer heuristic: path ends with .pdf and no DOM content — still allow attempt,
  // content script will report empty DOM honestly.
  return { supported: true };
}

export interface BrowserCapabilities {
  sidePanel: boolean;
  scripting: boolean;
  downloads: boolean;
  optionalHosts: boolean;
}

export function detectCapabilities(): BrowserCapabilities {
  try {
    const g = globalThis as Record<string, unknown>;
    const api = (g.browser ?? g.chrome) as Record<string, unknown> | undefined;
    return {
      sidePanel: Boolean(api && ((api as Record<string, unknown>).sidePanel ?? (api as Record<string, unknown>).sidebarAction)),
      scripting: Boolean(api && (api as Record<string, unknown>).scripting),
      downloads: Boolean(api && (api as Record<string, unknown>).downloads),
      optionalHosts: true,
    };
  } catch {
    return { sidePanel: false, scripting: false, downloads: false, optionalHosts: false };
  }
}
