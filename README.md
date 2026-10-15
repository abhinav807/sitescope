# SiteScope — Inspect. Understand. Improve.

Free, private, public website inspection and SEO analysis for Chromium browsers and Firefox. One click shows SEO metadata, headings, social tags, structured data, images, links, indexing signals and technical configuration — computed **locally in your browser**. No backend, no tracking, no ads, no account.

## Features (all working, all local)

- **Meta analyzer** — title, description, robots, canonical, lang, charset, viewport, duplicates, length heuristics (configurable).
- **Social preview** — og:* + twitter:* with real-value preview and canonical/og:url mismatch checks.
- **Headings visualizer** — document-order H1–H6, counts, skips, empty, multi-H1 (info), filters, JSON export, reversible on-page highlight.
- **Structured data** — safe JSON-LD parse (objects/arrays/@graph), tree + raw views, malformed/empty/duplicate-@id checks. No execution of page code.
- **Image auditor** — src, alt (missing vs empty-decorative distinguished), dims, loading/decoding/fetchpriority, srcset, format, broken heuristic, filters + CSV.
- **Link analyzer** — internal/external/anchor/email/tel/other/empty, accessible names, rel/target, malformed syntax check, search/filter/sort, CSV. Never auto-fetches targets.
- **Indexing** — meta robots, canonical consistency, honest `could-not-verify` for headers/status/redirects; optional user-triggered robots.txt check with narrow host permission.
- **Favicon/PWA** — icon links, apple-touch icons, manifest link (markup only, not fetched by default), MS tiles.
- **Technical** — URL anatomy (sensitive query keys masked), HTTPS/mixed content, DOM stats, partial Navigation/Paint timing. Never invents LCP/INP/CLS/Lighthouse.
- **Responsive helper** — opens the current URL in a real sized window (presets + custom). No fake “popup zoom = device” claims.
- **Findings overview** — critical/warning/info/passed with evidence + recommendation + limitations.
- **Exports** — JSON, links/images/findings CSV, printable HTML, print-to-PDF. Hostname+date filenames, query masking, correct escaping.
- **Resources** — Search Console, Rich Results Test, PageSpeed Insights, Schema.org, Lighthouse, Search Central (click-to-open only).
- **Settings** — theme, density, default tab, thresholds, export prefs, opt-in local history (off by default, capped, query-stripped), reset/clear, privacy + version info.

## Architecture

```
src/
  types/            shared AnalysisResult, Finding, settings, messaging contracts
  lib/analyzers/    metadata, headings, social, structuredData, images, links, indexing, favicon, technical, engine
  lib/browser/      api.ts, capabilities.ts, permissions.ts, messaging.ts (ALL browser differences here)
  lib/utils/        url, sanitize, dom
  lib/export.ts     JSON/CSV/HTML (local Blob downloads)
  lib/settings.ts   chrome.storage.local + memory fallback
  content/          read-only DOM runner + reversible highlight
  background/       MV3 service worker / Firefox scripts; user-triggered relay only
  popup/            compact status + Analyze + counts + quick links
  dashboard/        full report (13 tabs)
  sidepanel/        reuses popup for persistent inspection
  components/       Badge, Empty, Loading, CopyButton
  styles/           Tailwind + CSS variables (charcoal + lime)
  manifests/        base.json + per-browser overrides (firefox swaps background.service_worker -> scripts + gecko id)
scripts/
  build.mjs         vite --mode <browser> x5, validates manifest at root, zips to release/
  generate-icons.mjs  original icons, zero-dep PNG writer
tests/
  fixtures/         complete / issues / edge HTML
  engine.test.ts    extraction, classification, counts, empty states
  export-safety.test.ts  escaping, masking, unsupported pages, no-eval
```

Build tool decision: evaluated WXT (current, supports Chrome/Firefox MV3) but chose plain **Vite 5 + custom per-browser manifest step** to keep the dependency surface minimal, builds reproducible offline, and core analysis 100% portable DOM/JS. The `src/lib/browser/*` layer is the single compatibility boundary (feature detection, `browser.*` fallback). Scripts `build:chrome|firefox|edge|opera|brave`, `build:all`, `package:all` all exist and work.

## Quick start

```bash
npm install
npm run icons        # generate public/icons (already committed, re-run if needed)
npm test             # vitest run (16 tests)
npm run typecheck    # strict tsc
npm run build:chrome # dist/chrome + manifest.json
npm run build:all    # dist/{chrome,firefox,edge,opera,brave}
npm run package:all  # + release/sitescope-<browser>.zip
```

## Verification (1.0.1)

- `npm test` — 16/16 pass (engine, export/safety, Firefox-messaging interop).
- Real-browser harness: `npm run verify:chrome|edge|brave` loads the production
  `dist/` build into Playwright-driven Chromium / real Brave / real Edge and checks
  install, popup, dashboard (13 tabs), filters, exports, settings, robots.txt
  privacy, fixtures, large pages, network silence, and console cleanliness.
  Results: 20 PASS / 0 FAIL on all three runnable browsers (1 automation-only
  BLOCKED: the toolbar-click host grant needs a human). Evidence in `qa-shots/`.
- Firefox/Opera: artifact-validated only (binaries unavailable); see
  `docs/RELEASE_READINESS.md` for the manual pass + current SHA-256 checksums.

Load unpacked in Chrome/Edge/Brave/Opera: `chrome://extensions` → Developer mode → Load unpacked → `dist/chrome` (or edge/opera/brave). Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `dist/firefox/manifest.json`.

## Privacy

Local-only. No telemetry, analytics, ads, AI calls, history collection, or uploads. Optional robots.txt fetch asks for narrow host permission first. See `PRIVACY.md` and `PERMISSIONS.md`.

## Stores & docs

- `docs/API_COMPATIBILITY.md` — capability matrix.
- `docs/STORE_LISTINGS.md` — listing drafts for Chrome/Firefox/Edge/Opera.
- `docs/QA_CHECKLIST.md`, `docs/RELEASE_CHECKLIST.md` — manual + release gates.
- `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `PERMISSIONS.md`, `PRIVACY.md`.
- `landing/` — optional static site (placeholder store links until published).

Support: hello@goldenhourdelhi.co.in (maintainer: abhinavgoyal300@gmail.com).
