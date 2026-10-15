# Changelog

All notable changes to SiteScope are documented here. Format follows Keep a Changelog.

## [1.0.1] — 2026-10-11 (Release Verification Sprint)

Fixed two defects found during verification that would have broken the release:

- **Critical — content script was an ES module**: Vite code-splitting emitted `content.js` with `import ... from "./assets/..."`, which `chrome.scripting.executeScript({ files })` cannot inject (content scripts must be classic scripts). Analysis would have failed on every page. Fixed by bundling `content.js` and `background.js` as single-file IIFE classic scripts via `scripts/bundle-workers.mjs` (esbuild), with a build-time regression gate that fails the build if ESM markers ever reappear in those files.
- **Firefox messaging interop**: `tabs.sendMessage` / `runtime.sendMessage` used callback-only form, which Firefox's promise-based `browser.*` API ignores (would hang to timeout). Added dual callback/promise handling in `src/lib/browser/messaging.ts` + dashboard relay, with 5 new regression tests (`tests/messaging-compat.test.ts`).
- Dashboard footer version now reads the installed manifest version dynamically.
- Firefox manifest: dropped `"type": "module"` from `background.scripts` (bundle is
  classic IIFE, no modules needed) — keeps minimum support at Firefox 109 and clears
  `web-ext lint` min-version warnings (lint now 0 errors / 2 vendor-only warnings).
- Added automated real-browser harness (`scripts/verify-browser.mjs`, `npm run verify:chrome|edge|brave|opera`): 20 PASS / 0 FAIL on Chromium, Brave, Edge, and Opera; `web-ext lint` clean for Firefox; see `docs/RELEASE_READINESS.md`.

## [1.0.0] — 2026-10-11

Initial public release candidate.

- Full local analysis engine (metadata, headings, social, JSON-LD, images, links, indexing, favicon/manifest, technical).
- Popup, full dashboard (13 tabs), side panel entry.
- Findings with severity, evidence, recommendations and limitations; no fabricated scores/headers.
- JSON + CSV + printable HTML exports; masked queries; hostname+date filenames.
- Settings (theme/density/default tab/thresholds/export/history), opt-in local history, reset/clear.
- Optional robots.txt check behind narrow host permission; responsive helper via real sized windows.
- Cross-browser builds: chrome, firefox, edge, opera, brave (`dist/*`, `release/*.zip`).
- Vitest suite (engine + export/safety) over deterministic fixtures.
- Docs: README, PRIVACY, PERMISSIONS, API_COMPATIBILITY, QA/RELEASE checklists, store drafts.
