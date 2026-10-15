# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.0.x   | Yes       |

## Reporting a vulnerability

Email **hello@goldenhourdelhi.co.in** (maintainer copy: **abhinavgoyal300@gmail.com**) with:

- Extension version and browser + `dist/<browser>` build used.
- Steps to reproduce, expected vs actual behavior.
- Whether page content, settings, or exports are involved. **Do not include passwords, cookies, or full authenticated page dumps.**

We aim to acknowledge within 3 business days and to ship or document a fix promptly. We will credit reporters who wish to be named.

## Scope & guarantees

- SiteScope runs analysis locally; there is no server to breach and no browsing data to leak from our side.
- The extension never reads form values, cookies, local/session storage, or auth tokens, and never executes page-provided scripts.
- Extension pages enforce `script-src 'self'; object-src 'self'` and render page-derived strings as text with URL-scheme allowlisting.
- Optional host access is narrow (`<origin>/*`), user-triggered, and only fetches `/robots.txt` for display.
