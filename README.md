# SiteScope

**A privacy-first, cross-browser website inspection extension.**

**Made and designed by Abhinav Goyal and GoldenHour Delhi.**

SiteScope inspects the website you are already viewing and builds one consolidated,
evidence-backed report: SEO metadata, heading structure, social preview tags,
structured data, images, links, indexing signals, favicons, and technical page facts —
computed **locally in your browser**. No backend, no account, no tracking, no ads.

It is for web developers, SEOs, content editors, and students who currently juggle
separate tools for metadata, headings, links, images, and structured data. SiteScope
combines those checks into a single click with practical recommendations, honest
"could not verify" labels where the DOM cannot answer, and one-click exports.

> **Distribution note:** SiteScope is distributed directly, not through browser
> extension stores. You install it manually from a prebuilt ZIP (GitHub Releases,
> once published) or by building this repository from source. See
> [Download SiteScope](#d-download-sitescope).

## Contents

- [Features](#b-features)
- [Browser compatibility](#c-browser-compatibility)
- [Download SiteScope](#d-download-sitescope)
- [Install in every browser](#e-detailed-installation-instructions--every-browser)
- [First-time usage](#f-first-time-usage)
- [Permissions and privacy](#g-permissions-and-privacy)
- [Reports and data handling](#h-reports-and-data-handling)
- [Troubleshooting](#i-troubleshooting)
- [Development and testing](#j-development-and-testing)
- [Updating SiteScope](#k-updating-sitescope)
- [Support SiteScope](#l-support-sitescope)
- [Copyright and attribution](#m-copyright-and-attribution)
- [Known limitations](#n-known-limitations)
- [Roadmap and contributions](#o-roadmap-and-contributions)
- [FAQ](#p-faq)

## B. Features

Everything below is implemented in the source code (`src/lib/analyzers/`,
`src/dashboard/DashboardApp.tsx`, `src/popup/PopupApp.tsx`). The full report
dashboard has fourteen tabs: Overview, SEO, Headings, Social, Structured data,
Images, Links, Indexing, Technical, Responsive, Export, Resources, Support, Settings.

| Area | What it does |
| ---- | ------------ |
| **Overview** | Critical / warning / info / passed counts plus every finding with evidence, a practical recommendation, and stated limitations. Severity filter and text search. |
| **SEO metadata** | Title, meta description, robots, canonical, language, charset, viewport, theme-color, author; duplicate/empty tags; configurable length heuristics (title 30–60, description 70–160 by default). Length guidance is a display heuristic, never a claimed ranking penalty. |
| **Headings** | H1–H6 in document order with counts, skipped-level and empty-heading checks, level filter, text filter, JSON export, and a reversible on-page highlight toggle. |
| **Social** | Open Graph + Twitter/X tags with a share preview built from the real values, plus canonical / `og:url` / page-URL mismatch notes. |
| **Structured data** | Safe JSON-LD parsing (objects, arrays, `@graph`), tree + raw views, malformed/empty/duplicate-`@id` detection, download. Page content is never executed. |
| **Images** | Source URL, alt state (missing vs. empty-decorative distinguished), dimensions, loading/decoding/fetch-priority, `srcset`, format, broken-image heuristic; seven filters; CSV export. File size and cache behavior are honestly reported as not inferable from the DOM. |
| **Links** | Internal / external / same-page / email / telephone / other / empty classification, accessible names, `rel`/`target` analysis, malformed-URL syntax check; search, type/`rel` filters, sorting; CSV export. Targets are never fetched, so no link is ever labeled "broken" without checking. |
| **Indexing** | Meta robots and canonical consistency with honest `found` / `not-found` / `could-not-verify` labels for headers, status codes, and redirects. Optional **Check robots.txt** button (see [permissions](#g-permissions-and-privacy)). |
| **Technical** | URL anatomy (sensitive query keys masked), HTTPS vs HTTP, mixed-content hints, DOM statistics, and only the load-timing values the browser actually exposes. LCP/INP/CLS/Lighthouse scores are never invented. |
| **Favicon & PWA links** | Icon declarations, Apple touch icons, manifest link (markup only, not fetched), Microsoft tile tags — shown inside the Technical tab. |
| **Responsive helper** | Opens the current URL in a real window at preset (360–1920 px) or custom sizes, with overflow-checking guidance. Not a zoom trick, not a device emulator. |
| **Export** | Full-analysis **JSON**, **Links CSV**, **Images CSV**, **Findings CSV**, printable **HTML report**, plus browser print-to-PDF. Filenames are `sitescope-<host>-<date>.<ext>`; query values are masked. |
| **Resources** | Curated links (Search Console, Rich Results Test, PageSpeed Insights, Schema.org, Lighthouse, Search Central) that open only when clicked. |
| **Settings** | Theme (dark/light/system), density, default tab, metadata thresholds, export preferences, and opt-in local report history (off by default, capped, query-stripped) with clear/reset controls. |
| **Support** | In-extension Support page: voluntary "Buy Me a Chai" section (local QR image, offline), contact details, and About info. See [Support SiteScope](#l-support-sitescope). |

SiteScope is **not** a complete accessibility audit, a security audit, or a performance
benchmark — it reports what DOM inspection can honestly answer and says so where it cannot.

## C. Browser compatibility

One shared TypeScript + React codebase (`src/`) produces five browser-specific builds
via per-target manifests (`src/manifests/`) and `scripts/build.mjs`. Browser differences
live only in `src/lib/browser/*`. Outputs land in `dist/chrome`, `dist/firefox`,
`dist/edge`, `dist/opera`, and `dist/brave`.

| Browser | Package | Automated tests | Headed manual testing |
| ------- | ------- | --------------- | --------------------- |
| Google Chrome (via Chromium 131 proxy) | `release/sitescope-chrome.zip` | 20 PASS / 0 FAIL | BLOCKED (automation only) |
| Brave 155 | `release/sitescope-brave.zip` | 20 PASS / 0 FAIL | BLOCKED (automation only) |
| Microsoft Edge 155 | `release/sitescope-edge.zip` | 20 PASS / 0 FAIL | BLOCKED (automation only) |
| Opera 137 | `release/sitescope-opera.zip` | 20 PASS / 0 FAIL | BLOCKED (automation only) |
| Mozilla Firefox 157 target | `release/sitescope-firefox.zip` | manifest lint clean (0 errors) | BLOCKED (binary unavailable; runtime not yet exercised) |

Five ZIPs existing does **not** mean five fully verified browsers — the table above
is the honest record (full evidence: [docs/RELEASE_READINESS.md](docs/RELEASE_READINESS.md),
`qa-shots/<browser>-results.json`). Behavior is consistent across targets, but
permissions and surfaces differ slightly: Chromium builds use a service worker
background plus side panel; Firefox uses background scripts, a Gecko ID, and a
sidebar action instead. Feature set is otherwise identical.

## D. Download SiteScope

### Method 1: Download a prebuilt browser ZIP

1. Open the project repository: https://github.com/abhinav807/sitescope
2. Open the **Releases** section (right sidebar on the repository page).
3. Open the release published by the maintainer (look for `v1.0.1` or newer).
4. Download the ZIP matching your browser: `sitescope-chrome.zip`,
   `sitescope-firefox.zip`, `sitescope-edge.zip`, `sitescope-opera.zip`, or
   `sitescope-brave.zip`.
5. Extract it to a **permanent** folder (it must stay in place while installed).
6. Load the extracted folder following [your browser's section](#e-detailed-installation-instructions--every-browser).

> **Status: no GitHub Release has been published yet.** Until one exists, prebuilt
> ZIPs are unavailable — obtain one from a trusted maintainer or use Method 2.
> The repository's own **source-code ZIP is not a prebuilt extension** and cannot
> be loaded directly; it must be built first (Method 2).

### Method 2: Build from source

Prerequisites: **Node.js 18+** and npm (check with `node --version` and
`npm --version`). All commands run from the repository root (`E:\sitescopeext`
in these examples — substitute your own path).

```powershell
npm install          # install dependencies
npm run typecheck    # strict TypeScript check
npm test             # unit tests (20 tests)
npm run build:all    # builds dist/chrome, dist/firefox, dist/edge, dist/opera, dist/brave
npm run package:all  # builds + validates + writes release/sitescope-<browser>.zip
```

Single-browser builds also exist: `npm run build:chrome`, `build:firefox`,
`build:edge`, `build:opera`, `build:brave`. A build is required before a source
checkout can be loaded — the folder you select in the browser is the generated
`dist/<browser>` directory, never the repository root.

## E. Detailed installation instructions — every browser

> **Critical folder-selection warning:** always select **the folder containing
> `manifest.json`, not the repository root.** For a source build that folder is
> `dist/chrome` (or `dist/edge`, etc.) — not `E:\sitescopeext` and not
> `E:\sitescopeext\dist`. For a ZIP, it is the folder you extracted (which itself
> contains `manifest.json`). `E:\sitescopeext` is only an example path from the
> developer's machine; yours will differ. The ZIP must be extracted first — browsers
> cannot load a `.zip` file. If the folder has no readable `manifest.json`, you
> picked the wrong folder or the build/extraction failed (see
> [Troubleshooting](#i-troubleshooting)).

### Google Chrome

1. Use the extracted `sitescope-chrome` folder (or `dist/chrome` from a source build).
2. In Windows File Explorer, right-click the ZIP → **Extract All…** (if applicable).
3. Open Chrome and navigate to `chrome://extensions`.
4. Enable **Developer mode** (toggle, top-right).
5. Click **Load unpacked** and select the folder containing `manifest.json`.
6. Confirm **SiteScope** appears in the extension list with version 1.0.1 and no errors.
7. Click the puzzle-piece toolbar icon, then the pin next to SiteScope to keep it visible.
8. To reload after a code change: return to `chrome://extensions` and click the
   reload icon on the SiteScope card.

### Microsoft Edge

1. Use the extracted `sitescope-edge` folder (or `dist/edge`).
2. Extract the ZIP with File Explorer if needed.
3. Navigate to `edge://extensions`.
4. Enable **Developer mode** (toggle, bottom-left).
5. Click **Load unpacked**, select the folder containing `manifest.json`.
6. Confirm SiteScope appears in the list without errors; pin it from the toolbar
   (`…` → Extensions → pin) if desired.
7. Reload from `edge://extensions` after code changes.

### Brave

1. Use the extracted `sitescope-brave` folder (or `dist/brave`).
2. Extract the ZIP with File Explorer if needed.
3. Navigate to `brave://extensions`.
4. Enable **Developer mode** (toggle, top-right).
5. Click **Load unpacked**, select the folder containing `manifest.json`.
6. Confirm SiteScope appears without errors; pin it via the puzzle-piece menu.
7. Reload from `brave://extensions` after code changes.

### Opera

1. Use the extracted `sitescope-opera` folder (or `dist/opera`).
2. Extract the ZIP with File Explorer if needed.
3. Open the Extensions manager: navigate to `opera://extensions` (or Sidebar →
   Extensions, or `Ctrl+Shift+E`).
4. Enable **Developer mode** (toggle at the top of the page). Opera's manager shows
   its own developer controls once this is on — unlike Chrome there is no
   bottom-left switch; the toggle sits at the top of Opera's page.
5. Click the **Load unpacked** button that appears and select the folder containing
   `manifest.json`.
6. Confirm SiteScope appears in Opera's extension list without errors.
7. Reload it from the same page after code changes.

### Mozilla Firefox

1. Use the extracted `sitescope-firefox` folder (or `dist/firefox`).
2. Extract the ZIP with File Explorer if needed.
3. Navigate to `about:debugging#/runtime/this-firefox`.
4. Click **Load Temporary Add-on…**.
5. In the file dialog, open the extracted folder and select its `manifest.json`
   file (current Firefox accepts the manifest to identify the add-on directory).
6. Confirm SiteScope appears under Temporary Extensions without errors.

> Firefox removes temporary add-ons when it restarts — you must repeat these steps
> each session. Permanent installation requires a Mozilla-signed package, which
> this direct-distribution project does not provide. Do not use unsafe
> configuration workarounds to force unsigned extensions to persist. (Firefox's
> flow differs from Chrome's on purpose; the steps above are not interchangeable.)

## F. First-time usage

1. Open a normal website over `http(s)` (internal browser pages, the web store,
   and PDF viewers cannot be inspected — SiteScope tells you so).
2. Click the **SiteScope toolbar icon** to open the popup. It shows the site's
   domain, page title, and an **Analyze page** button.
3. Click **Analyze page**. The popup shows critical/warning/passed counts, top
   findings, and quick links (SEO, Links, Images, Technical).
4. Click **Open full report** for the dashboard with all fourteen tabs
   (Overview → Settings, listed in [Features](#b-features)).
5. Use the severity dropdown and search box on findings lists; use the level,
   type, `rel`, and text filters on the Headings, Images, and Links tabs.
6. On the **Export** tab, click a **Download** button (JSON, Links/Images/Findings
   CSV, printable HTML) or use **Print this report** for print-to-PDF.
7. The **Indexing** tab's **Check robots.txt** button requests a narrow,
   origin-only permission first — allow it to fetch once, or deny it (the check
   then reports `denied` and nothing is fetched).

## G. Permissions and privacy

Verified against [docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md) and the shipped manifests — plain-English version:

| Permission | Required? | Why |
| ---------- | --------- | --- |
| `activeTab` | Required | Read the tab you click Analyze on — the narrowest way to access page content. |
| `scripting` | Required | Inject the analyzer into that tab on demand (no persistent content scripts, no broad host access). |
| `storage` | Required | Keep settings, the last result, and opt-in history in on-device `storage.local` only. |
| `http://*/*`, `https://*/*` | **Optional** | Requested only when you click **Check robots.txt**, narrowed to `<origin>/*` at request time. |

- **Network:** the only request SiteScope itself ever makes is that single
  `robots.txt` fetch after your explicit click + grant. External resource links
  open only when you click them.
- **No telemetry, advertising, analytics, account registration, AI calls, or
  background tracking.** Analysis runs in your browser; exports are files you save.
- **No collection** of passwords, cookies, form contents, or auth tokens — the code
  contains no such access, and extension pages enforce
  `script-src 'self'; object-src 'self'`.
- **Denying** the optional permission only disables the robots.txt check; every
  core analyzer keeps working. Sensitive query keys (token, secret, …) are masked
  in the UI and reports by default.

## H. Reports and data handling

- **JSON** — the complete analysis (all sections + findings); opens in any text editor.
- **Links / Images / Findings CSV** — open in Excel, Google Sheets, LibreOffice; first row is headers; content is correctly escaped.
- **Printable HTML** — a clean report page; use browser Print → Save as PDF for PDFs.
- Reports contain real extracted page data (URLs, metadata, findings, masked query
  strings). Filenames never include query strings. **Inspect a report before sharing
  it publicly** — it describes the analyzed page and may include URLs you would
  rather not publish.

## I. Troubleshooting

| Problem | Fix |
| ------- | --- |
| `Manifest file is missing or unreadable` | You selected the wrong folder. Select the folder that directly contains `manifest.json` (e.g. `dist/chrome`), not the repo root or `dist`. |
| Selected the repository root | Re-do **Load unpacked** pointing at `dist/<browser>` (source) or the extracted ZIP folder. |
| `manifest.json` missing after extraction | Re-extract the ZIP (File Explorer → Extract All…); if building from source, rerun `npm run build:all` and check for build errors. |
| Extension not in the toolbar | Open the puzzle-piece menu and pin SiteScope. |
| Not working on a page | `chrome://`, `edge://`, `about:`, web-store, and PDF-viewer pages are blocked by the browser — open a normal `http(s)` site. |
| Permission prompt denied | Only the robots.txt check is affected; it shows `denied`. Click it again to re-prompt. |
| Export doesn't download/save | Headless/test browsers may swallow downloads; in a normal browser check the download shelf and pop-up settings, then retry the card's **Download** button. |
| Won't reload after code changes | Rebuild (`npm run build:<browser>`), then press reload on the extension card; confirm the version footer matches. |
| Firefox add-on gone after restart | Expected — temporary add-ons are removed on restart. Repeat the [Firefox steps](#mozilla-firefox). |
| Browser refuses another browser's build | Use the matching ZIP/folder per [compatibility table](#c-browser-compatibility); Firefox cannot load Chromium builds and vice versa. |
| Build fails from source | Run `npm install` first; requires Node.js 18+; paste the full error when asking for help. |

List every manifest in the build tree (replace the path if your project lives elsewhere):

```powershell
Get-ChildItem "E:\sitescopeext\dist" -Recurse -Filter manifest.json -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty FullName
```

If rebuilding is necessary: `npm run build:all` (or `npm run build:<browser>`), then `npm run package:all` for ZIPs.

## J. Development and testing

- **Requires:** Node.js ≥ 18, npm. Stack: TypeScript 5 (strict), React 18, Vite 5,
  Tailwind 3, Lucide icons, Vitest, esbuild single-file bundling for
  content/background scripts.
- `npm install` — dependencies. `npm run typecheck` — strict TS gate (also the `lint` script).
- `npm test` — 20 unit tests (engine fixtures, export escaping/safety, Firefox-messaging interop, product identity).
- `npm run build:all` / `npm run package:all` — five builds + validated ZIPs.
- `npm run verify:chrome|edge|brave|opera` — real-browser harness (extension install, 14 dashboard tabs, filters, exports, settings, fixtures, large pages, network silence). `npm run lint:firefox` — `web-ext` manifest validation.
- Docs: [docs/API_COMPATIBILITY.md](docs/API_COMPATIBILITY.md) (capability matrix), [docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md)
  (audit evidence), [docs/QA_EXECUTION_SHEET.md](docs/QA_EXECUTION_SHEET.md) (manual checklist with results),
  [docs/RELEASE_READINESS.md](docs/RELEASE_READINESS.md) (verdict + SHA-256), [docs/SCREENSHOTS.md](docs/SCREENSHOTS.md) (genuine captures).

Automated checks never replace headed manual QA: toolbar-click analysis, permission
grant/deny dialogs, OS file-save, print-to-PDF, and Firefox/Opera runtime passes
require a human (tracked in the QA execution sheet).

## K. Updating SiteScope

1. Download the new browser-specific ZIP (Releases section, once published) or rebuild from updated source.
2. Extract it to a **new** folder (keep the old one until the new build works).
3. Open the browser's extension management page.
4. Remove the old unpacked entry if desired (optional for Chromium; required to avoid duplicates).
5. Load the new extracted build.
6. Verify the version in the dashboard footer (it reads the installed manifest).

Settings live in the browser's `storage.local` and normally survive an update, but
never delete your only copy of anything before confirming. For Firefox, repeat the
temporary add-on steps each session regardless.

## L. Support SiteScope

Open the dashboard's **Support** tab (or the popup footer's **Support** link).

**Built with curiosity. Supported by chai. ☕** SiteScope exists to make website
inspection simpler, more transparent, and privacy-friendly. If it helps you, you
can voluntarily buy the creator a chai via the **Buy Me a Chai** section: scan the
locally bundled UPI QR code with any UPI payment app and verify the recipient in
your own app. To be explicit:

- Contributions are entirely voluntary.
- Every core feature remains available without payment.
- No payment is ever initiated automatically — you choose to scan and pay.
- No tax-deductibility is claimed or implied.
- The page works offline; the QR is bundled locally; nothing is tracked or sent.

Contact: **hello@goldenhourdelhi.co.in** (support), **abhinavgoyal300@gmail.com**
(maintainer) — also reachable with copy buttons on the Support page.

## M. Copyright and attribution

Made and designed by Abhinav Goyal and GoldenHour Delhi.

`Copyright © 2026 Abhinav Goyal and GoldenHour Delhi. All rights reserved.`

Original SiteScope code, design, and docs are MIT-licensed — see [LICENSE](LICENSE).
Third-party components keep their own licenses and are not claimed as ours; see
`NOTICE.md` for the full table (only React, ReactDOM, and lucide-react ship inside
the extension). `SiteScope` is the project's claimed (unregistered) product name —
no registration is claimed and no ®/™ is used.

## N. Known limitations

- Response headers, HTTP status codes, and redirect chains are reported as
  **could not verify** — the DOM cannot answer them, by design.
- Link targets are never fetched automatically; reachability is a manual spot-check.
- No LCP/INP/CLS/Lighthouse scores anywhere — use PageSpeed Insights for those.
- Unsigned Firefox installs are temporary (removed on restart; no permanent
  installation without Mozilla signing).
- Headed manual QA is still pending for toolbar-click flows, permission dialogs,
  file-save, print-to-PDF, and Firefox/Opera runtime ([docs/QA_EXECUTION_SHEET.md](docs/QA_EXECUTION_SHEET.md)).
- Mobile browsers are out of scope for the desktop-first 1.0.x line.

## O. Roadmap and contributions

Near-term, already-planned work (ideas, not promises): finish the headed manual QA
matrix, capture remaining store-style screenshots, and publish the first GitHub
Release with signed SHA-256 hashes. Longer-term ideas from the project docs include
lightweight result visualizations and a Playwright regression harness — both
unstarted. Nothing here is guaranteed or scheduled.

There are no issue templates in the repository. To report a bug, open an issue at
https://github.com/abhinav807/sitescope/issues with the extension version, browser
and version, steps to reproduce, and expected vs. actual behavior (never include
passwords or private page contents) — or email the support contacts above. Code
contributions should follow [CONTRIBUTING.md](CONTRIBUTING.md) (original code only, tests required,
no new broad permissions without discussion).

## P. FAQ

- **Is SiteScope free?** Yes — free, no ads, no subscriptions, no account. Optional
  chai contributions are purely voluntary.
- **Does it require an extension store?** No. It is direct-distributed: prebuilt ZIP
  or source build, loaded manually. It is not on any store.
- **Why must I enable Developer mode?** That switch is what lets Chromium browsers
  load unpacked extensions from a folder. It changes nothing about the extension.
- **Why can't I select the repository root?** Browsers need the folder containing
  `manifest.json` (`dist/<browser>` or the extracted ZIP folder). The repo root has
  no manifest, so loading it fails by design.
- **Why is Firefox installation temporary?** Firefox removes unsigned temporary
  add-ons on restart as a security policy. Permanent installs need Mozilla signing.
- **Does SiteScope send my browsing data anywhere?** No. Analysis is local; the only
  request it can ever make is a `robots.txt` fetch you explicitly trigger after a
  permission prompt. See [Permissions and privacy](#g-permissions-and-privacy).
- **How do I update it?** New ZIP → new folder → remove old entry → load new →
  check the version footer. Details in [Updating](#k-updating-sitescope).
- **How can I support the creator?** The dashboard **Support** tab (chai QR,
  voluntary) or email — see [Support SiteScope](#l-support-sitescope).
