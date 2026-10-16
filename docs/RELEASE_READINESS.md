# Release Readiness Report — SiteScope 1.0.2 (release gate 2026-10-16; v1.0.1 tag left untouched at dc07d3f)

Verdict: **READY except for the manual-pass blocker below.** Support contacts are
configured; nothing was submitted to any store. Every PASS was actually executed;
automation gaps are marked BLOCKED, never inferred.

## A. Automated gate — PASS

| Check | Result | Evidence |
| ----- | ------ | -------- |
| `typecheck` (strict tsc) | PASS | clean (re-run 2026-10-15) |
| Unit tests | PASS | 16/16, re-run 2026-10-15 (`engine` 4, `export-safety` 7, `messaging-compat` 5) |
| `build:all` (5 targets) | PASS | `dist/{chrome,firefox,edge,opera,brave}` + `bundle-workers` gate; rebuilt 2026-10-15 |
| `package:all` (5 ZIPs) | PASS | `release/sitescope-*.zip`, manifest at root, 0 `.map`, 0 `node_modules` (22 files each) |

## B. Real-browser verification (harness `scripts/verify-browser.mjs`, local fixtures)

| Browser | Build | Result |
| ------- | ----- | ------ |
| Playwright Chromium 131 (Blink — proxies Chrome) | `dist/chrome` 1.0.1 | **20 PASS, 0 FAIL, 1 BLOCKED** |
| Brave 155.1.97.56 (real binary) | `dist/brave` 1.0.1 | **20 PASS, 0 FAIL, 1 BLOCKED** |
| Edge 155.0.4283.45 (real binary) | `dist/edge` 1.0.1 | **20 PASS, 0 FAIL, 1 BLOCKED** |
| Opera 137.0.6036.39 (real binary) | `dist/opera` 1.0.1 | **20 PASS, 0 FAIL, 1 BLOCKED** |
| Firefox 157.0.1 | `dist/firefox` 1.0.1 | **Lint PASS (0 errors, 2 vendor-only warnings); runtime BLOCKED** — install reported success but `firefox.exe` is absent from disk (Store/registry present, files missing), so no runtime run was possible |

(All four runnable browsers were verified against 1.0.1 `dist/` content; the only
post-verification change anywhere was the Firefox manifest `type` removal, which
does not touch any Chromium build.)

Per-check outcomes (identical on all four runnable browsers): install-SW PASS,
popup-render PASS, engine-in-real-DOM PASS (15 findings), 14/14 dashboard tabs PASS
(incl. new Support tab), severity filter PASS, search PASS, export-tab PASS, JSON round-trip PASS, filename
PASS, links CSV PASS (3 rows, real URLs), images CSV PASS, HTML report PASS,
settings persistence PASS, robots-privacy PASS (0 silent fetches), issues-fixture
PASS (5 critical/14 warnings incl. navigation re-analysis), large-page PASS (10,005
nodes, ~300–650 ms), empty-page PASS, unsupported-state PASS, network-audit PASS
(0 external requests), console-clean PASS (0 uncaught errors).
BLOCKED everywhere: real toolbar-click host-grant injection (automation cannot
produce the activeTab user gesture; error text confirms only the grant is missing,
not a parse failure) and the OS-level file-save step (headless pipeline drops all
downloads; export content verified via blob capture instead).

Bugs found & fixed during the sprints (see CHANGELOG 1.0.1):
1. **Critical**: `content.js` shipped as ESM — `scripting.executeScript` injection
   would have failed on every page. Now single-file IIFE + build gate.
2. Firefox promise-style messaging ignored callbacks — dual handling + 5 tests.
3. Firefox manifest: dropped `"type": "module"` from `background.scripts` (classic
   IIFE needs no modules) — keeps Firefox 109 support, clears `web-ext lint`
   min-version warnings (lint: 0 errors / 0 notices / 2 warnings, both react-dom
   vendor `innerHTML` notices; our code never sets innerHTML).

## C. Security & privacy — PASS (details: `docs/SECURITY_AUDIT.md`)

Prod deps 0 vulns; 3 dev-only advisories dispositioned (breaking fixes, none ship);
single user-gated robots.txt fetch; minimal permissions on all manifests;
restrictive CSP everywhere; no telemetry/cookies/form access/eval; exports mask
queries; policies match behavior.

## D. Cross-browser manifests — PASS (artifact + lint) / BLOCKED (Firefox runtime)

Chromium four: MV3 `service_worker`, valid, installed headless (Chrome-proxy) and
headed-equivalent (Brave, Edge, Opera — all with real extension IDs and running
background workers). Firefox: MV3 `background.scripts` (classic, no `type`) +
gecko id + `sidebar_action`; `web-ext lint` 0 errors. Firefox runtime load is
NOT APPLICABLE here (binary unavailable despite install attempt); the dual-style
messaging path is unit-covered for the promise-style API.

## E. Release blockers

1. **RESOLVED — support contact**: hello@goldenhourdelhi.co.in (primary) and
   abhinavgoyal300@gmail.com (maintainer), set in README, SECURITY.md,
   PRIVACY.md, `docs/STORE_LISTINGS.md`, and `landing/index.html` on 2026-10-11.
2. **BLOCKER — manual pass required** (cannot be automated here): real toolbar-click
   Analyze on 2–3 public sites per runnable browser; permission-grant + deny paths
   for robots.txt; OS file-save + print-to-PDF; Firefox + Opera full install→export;
   store screenshots (real ones exist in `qa-shots/` as a start: popup, overview,
   headings, export per browser).

NOT APPLICABLE: mobile browsers, backend/data-deletion flows (no backend),
payments/identity disclosures (none).

## F. Final artifacts (SHA-256, v1.0.2 release gate 2026-10-16; unit 56/56, browser 20/0/1 Chrome, lint 0/0/2, audit 0)

- `release/sitescope-chrome.zip` — 145364 B — `B7C8A144E98056A49DE7D66A4539DF970C670B4F27468757DF4A0E4E4ABFC7A7`
- `release/sitescope-firefox.zip` — 145413 B — `778A20F2A249719DCDDF0EB774CD653BAD7AAD012139E06901A857DD76BF72B2`
- `release/sitescope-edge.zip` — 145364 B — `39C6645C2B65D744F84F2026912D382019DC22F17F732B7F8C27CF9EAC2C44AA`
- `release/sitescope-opera.zip` — 145364 B — `5B92F7E4A75605B7D73AF6601FAC459B2A142A3853825CE4DD181087701E3023`
- `release/sitescope-brave.zip` — 145364 B — `E8F32BF5FB71A2633695979761E92673530B8688960D0753ECC8F40143DDCE93`

Store drafts: `docs/STORE_LISTINGS.md` (support contacts final). QA evidence: `qa-shots/{chrome,brave,edge,opera}-results.json` + PNG screenshots (see `docs/SCREENSHOTS.md`). Release-notes draft: `docs/RELEASE_NOTES_v1.0.2.md` (body for the GitHub Release below).
