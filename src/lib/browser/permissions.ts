/** Optional-permission flows (robots.txt / sitemap fetch). Narrow + user-triggered only. */
import { extensionApi } from './api';

export async function hasHostAccess(originPattern: string): Promise<boolean | null> {
  const api = extensionApi();
  try {
    if (api?.permissions?.contains) {
      return await api.permissions.contains({ origins: [originPattern] });
    }
  } catch {
    return null;
  }
  return null; // unknown outside extension contexts
}

export async function requestHostAccess(originPattern: string): Promise<boolean> {
  const api = extensionApi();
  try {
    if (api?.permissions?.request) {
      return await api.permissions.request({ origins: [originPattern] });
    }
  } catch {
    return false;
  }
  return false;
}

export function originPatternFor(urlStr: string): string | null {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return `${u.origin}/*`;
  } catch {
    return null;
  }
}
