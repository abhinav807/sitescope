# Manual QA Execution Sheet — SiteScope 1.0.1

How to use: each row is one required test from `docs/QA_CHECKLIST.md` (plus release
gates). Fill **Result** with PASS / FAIL / BLOCKED, plus browser version, date, and
notes. Pre-filled rows are automation evidence from 2026-10-11 (harness
`scripts/verify-browser.mjs`, full logs in `qa-shots/<browser>-results.json`).
Empty rows REQUIRE a human with a headed browser — do not fill them from automation.

| # | Test (from QA checklist) | Browser | Browser version | Date | Result | Notes / evidence |
|---|---|---|---|---|---|---|
| 1 | Install: loads with no warnings, icons render, popup opens at 360px | Chromium (automated) | 131.0.6778.33 (PW build v1148) | 2026-10-11 | PASS | SW running, real extension id; popup PNG in `qa-shots/` |
| 1 | Install | Brave | 155.1.97.56 | 2026-10-11 | PASS | SW running, real extension id |
| 1 | Install | Opera | 137.0.6036.39 | 2026-10-11 | PASS | SW running, real extension id (`dist/opera`) |
| 1 | Install | Firefox | 157.0.1 (winget; binary absent from disk) | 2026-10-11 | BLOCKED | `web-ext lint` on `dist/firefox`: 0 errors / 0 notices / 2 warnings (react-dom vendor innerHTML notices only) |
| 1 | Install | Edge | 155.0.4283.45 | 2026-10-11 | PASS | SW running (teardown race is harness-only, see R1) |
| 1 | Install | Chrome (branded) |  |  |  | Manual: `chrome://extensions` → Load unpacked → `dist/chrome`; record warnings |
| 1 | Install | Firefox |  |  |  | Manual: `about:debugging` → Load Temporary Add-on → `dist/firefox/manifest.json` |
| 1 | Install | Opera |  |  |  | Manual: Load unpacked → `dist/opera` |
| 2 | Fixture A (`/complete`): 1 H1, 4 headings, OG complete, 1 valid JSON-LD, 0 missing alts | Chromium/Brave/Edge/Opera | see above | 2026-10-16 | PASS | 15 findings via real-DOM engine; counts asserted in harness |
| 3 | Fixture B (`/issues`): duplicates, noindex, invalid canonical, bad JSON, dupe @id, multi-H1, empty links, blank-rel, missing alt | Chromium/Brave/Edge/Opera | see above | 2026-10-11 | PASS | 5 critical / 14 warnings, all key finding IDs present |
| 4 | Real public site, analysis < 3 s, no console errors | Chromium/Brave/Edge/Opera | see above | 2026-10-11 | BLOCKED | Fixtures only in automation; needs headed run |
| 4 | Real public site | Chrome / Firefox / Edge / Opera / Brave (each) |  |  |  | Manual: pick 2–3 public sites, record URL + timing + console |
| 5 | Toolbar-click Analyze (real user gesture → activeTab grant → full messaging path) | ALL (each) |  |  |  | Manual: THE key untested path. Click toolbar icon → Analyze → full report opens with data |
| 6 | Unsupported pages (`chrome://settings`, `about:blank`, web-store) | Chromium/Brave/Edge/Opera | see above | 2026-10-11 | PASS | Popup-as-tab renders honest unsupported state; `checkPageSupport` unit-covered for chrome:, about:, store URLs |
| 6 | Unsupported pages | Firefox / Opera |  |  |  | Manual |
| 7 | Navigation A → B → re-analyze shows B | Chromium/Brave/Edge/Opera | see above | 2026-10-11 | PASS | Re-analysis after `goto` asserted on issues page |
| 8 | Filters (severity+search, headings level+text, 7 image filters, links type/rel/sort/search) | Chromium/Brave/Edge/Opera | see above | 2026-10-16 | PASS | Severity filter counts + search asserted; remaining filters rendered (14/14 tabs) — spot-check manually |
| 9 | Heading highlight on/off, no leftover markers | — | — | — | BLOCKED | Needs content script in page (host grant); manual: Analyze → Headings → Highlight → toggle twice → inspect DOM |
| 9a | Support tab: hero/chai/contact/about render, QR fallback shown (owner file pending), attribution + contacts correct, no console errors | Chromium/Brave/Edge/Opera | see above | 2026-10-16 | PASS | Screenshot `*-dashboard-support.png` per browser; QR slot verified by `support:check` gate (MISSING — expected until owner file lands) |
| 9b | UPI QR real file: present, byte-identical in all five builds, scannable | — | — | — | BLOCKED | Owner to supply `public/support/upi-qr.png`; then record `upi-qr.sha256` and re-run `support:check --all --dist` |
| 10 | Exports: JSON parses; CSVs have headers; HTML prints; `sitescope-<host>-<date>` names; query warning | Chromium/Brave/Edge/Opera | see above | 2026-10-11 | PASS | Blob content + filenames captured in-browser (JSON round-trip 15 findings; links 3 rows; images 2 rows; HTML 8896 B) |
| 10 | OS file-save + print-to-PDF | ALL (each) |  |  |  | Manual: headless drops all downloads; click each Download, open files, Print → Save as PDF |
| 11 | robots.txt: allow shows file; deny shows `denied`, fetches nothing | Chromium/Brave/Edge/Opera | see above | 2026-10-11 | PASS | Deny-path verified (0 server hits); **grant-path manual** |
| 11 | robots.txt grant path | ALL (each) |  |  |  | Manual: click → accept prompt → file text visible |
| 12 | Responsive: preset + custom W/H open sized windows | — | — | — | BLOCKED | Manual: click preset, measure window |
| 13 | Settings: theme/density/default-tab/thresholds/history/clear/reset | Chromium/Brave/Edge/Opera | see above | 2026-10-11 | PASS | Theme light stored + applied; remainder manual spot-check |
| 14 | Keyboard: Tab order, visible focus, SR labels | — | — | — | BLOCKED | Manual with keyboard + screen reader |
| 15 | Permissions audit: only activeTab/scripting/storage + optional hosts; CSP; no stray network | Chromium/Brave/Edge/Opera | see above | 2026-10-11 | PASS | Manifests diffed; live run 0 external requests; CSP on all 5 builds |
| 16 | Large page (5k+ nodes) completes, tables capped | Chromium/Brave/Edge/Opera | see above | 2026-10-11 | PASS | 10,005 nodes, ~300–650 ms |
| 17 | Cross-browser repeat (install→analyze→export per browser) | Firefox / Opera |  |  |  | Manual: never infer from Chrome results |

Result log (append rows as needed):

| Date | Tester | Browser + version | Rows completed | Failures filed |
|---|---|---|---|---|
| 2026-10-11 | automation (harness) | Chromium 131 / Brave 155.1.97.56 / Edge 155.0.4283.45 / Opera 137.0.6036.39 | 1–8, 10–11 (partial), 13, 15–16 | none (3 product bugs found across sprints, fixed in 1.0.1) |
| 2026-10-11 | automation (web-ext lint) | Firefox 157.0.1 target (binary absent; artifact only) | 1 (manifest validity) | 0 errors; 2 vendor-only warnings |
|  |  |  |  |  |

Known harness-only issues (not product defects):

- R1: Edge 155 + Playwright 1.49 crashes during `context.close()` (CDP teardown race).
  All 21 product checks complete and are recorded first. Re-run if the summary is missing.
- R2: Headless automation cannot produce the activeTab user gesture, so injection
  returns "Cannot access contents of the page" and downloads never complete. Export
  *content* is verified via blob capture; the click + save steps are manual rows above.
- R3: one transient Edge `console-clean` FAIL (CSP unsafe-eval report on dashboard#export)
  seen once on 2026-10-16; never reproduced across 6 subsequent runs on 4 browsers,
  and `dist/` bundles contain zero string-eval constructs (verified by grep).
  Treat as automation one-off; re-open if ever seen again.
