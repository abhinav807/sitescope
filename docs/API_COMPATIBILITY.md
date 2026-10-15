# API compatibility matrix (verified against current stable docs + build outputs)

Targets: Chrome 114+, Edge 114+, Opera (Chromium 100+), Brave (Chromium 114+), Firefox 109+ (desktop first; mobile evaluated separately).

| Capability | Chrome / Edge / Opera / Brave (MV3) | Firefox (MV3 + gecko settings) | SiteScope handling |
| ---------- | ----------------------------------- | ------------------------------ | ------------------ |
| Manifest version | MV3, `action`, `background.service_worker` (module) | MV3, `action` + `background.scripts` + `browser_specific_settings.gecko`, `sidebar_action` | `src/manifests/base.json` + `firefox.json` override; `scripts/build.mjs` validates `manifest.json` at each `dist/<browser>/` root |
| Background | Service worker, event-driven, no DOM | Event page scripts, no DOM | Same `src/background/background.ts` bundle; no DOM/network imports; message relay only |
| Messaging (`tabs.sendMessage`, `runtime.onMessage`) | Callback + promise forms | `browser.*` promises | `src/lib/browser/messaging.ts`: callback form with timeout + `lastError` check; `extensionApi()` prefers `browser` then `chrome` |
| Storage (`storage.local`) | Promise in MV3 | Promise | Promisified wrapper + in-memory fallback for tests; history/settings keys namespaced, local-only |
| Active tab (`tabs.query`, `activeTab`) | Supported | Supported | `getActiveTab()`; unsupported-scheme guard before injection |
| Content injection (`scripting.executeScript`) | Supported | Supported (109+) | User-triggered only; falls back to direct `sendMessage` if already injected |
| Optional hosts (`permissions.request`) | Supported | Supported (per-origin prompt) | `requestHostAccess('<origin>/*')` only from robots.txt button; denial → `denied` state, no retry loop |
| Tabs/windows (`tabs.create`, `windows.create`) | Supported | `tabs.create` yes; `windows.create` partial | Responsive helper prefers `windows.create`, falls back to `window.open` with size features |
| Side panel | `side_panel` (Chrome 114+) | `sidebar_action` | Both declared via overrides; panel reuses popup bundle; absence degrades to popup+dashboard |
| Downloads/exports | `downloads` API available but **not required** | Same | Portable Blob + anchor download (`downloadBlob`); no `downloads` permission requested |
| CSP (`extension_pages`) | `script-src 'self'; object-src 'self'` | Same | No remote code, no eval, no inline handlers; page strings rendered as text |

Non-goals: mobile browsers (install + API surface differ — marked **unverified**), persistent background work, automatic crawling/fetching, header/status inference (always `could-not-verify` from DOM).

Framework note: WXT was evaluated (mature, supports the above matrix) but plain Vite + a 60-line manifest step was chosen to minimize dependencies while producing identical per-browser artifacts. The `src/lib/browser/*` boundary preserves the same portability contract.
