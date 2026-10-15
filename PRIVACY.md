# SiteScope Privacy Policy (v1.0.0 — matches actual behavior)

**Summary: SiteScope analyzes pages locally in your browser. It collects nothing, transmits nothing, and stores only settings (and opt-in history) on your device.**

## Data processed

- When you click **Analyze page**, the content script reads the current document's markup that is already visible to the browser (titles, meta tags, headings, links, images, JSON-LD, icon links) and computes findings on-device.
- No passwords, no form input values, no cookies, no local/session storage, no auth tokens are read. The code contains no selectors for inputs and no storage/cookie APIs.
- No page content, URLs, or reports leave your device unless **you** explicitly export a file (saved locally) or click an external resource link (which opens that third-party site normally).

## Data stored

- `chrome.storage.local` (or `browser.storage.local` in Firefox), device-only, never synced:
  - `sitescope:settings:v1` — theme, density, thresholds, export prefs.
  - `sitescope:last-result` — most recent analysis so the dashboard can render it.
  - `sitescope:history:v1` — only if you enable history in Settings; capped (default 10, max 50), URLs stripped of query strings, deletable via Clear history.
- No server, no account, no analytics SDK, no advertising ID.

## Permissions & network

- Base: `activeTab` (read the tab you invoke it on), `scripting` (inject the analyzer on demand), `storage` (settings).
- Optional: narrow host access (`https://origin/*`) only when you click **Check robots.txt**; fetches `/robots.txt` once for display.
- External resource links (Search Console, Rich Results Test, etc.) open only on click; the target site may receive the URL you paste there.

## Contact

Questions: **hello@goldenhourdelhi.co.in** (secondary contact: **abhinavgoyal300@gmail.com**).
