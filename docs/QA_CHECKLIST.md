# Manual QA checklist (run against `dist/<browser>` before every release)

Setup: load unpacked build per README; open DevTools for the popup (right-click → Inspect) and dashboard; keep console visible.

- [ ] Install: extension loads with no warnings; icons render; popup opens at 360px.
- [ ] Fixture A (`tests/fixtures/complete.html` served via local http): Analyze → 1 H1, 4 headings, OG complete, 1 valid JSON-LD, 0 missing alts; counts match DOM.
- [ ] Fixture B (`issues.html`): duplicates, noindex (critical), invalid canonical, invalid+empty JSON-LD, dupe @id, multi-H1 info, empty links, blank-target rel, missing alt — all present with evidence.
- [ ] Real site (e.g. example.com): analysis completes < 3s, no uncaught console errors.
- [ ] Unsupported: `chrome://settings`, `about:blank`, web-store URL → friendly unsupported message, no hang.
- [ ] Navigation: analyze page A, navigate to B, re-analyze → results reflect B (no stale render).
- [ ] Filters: findings severity + search; headings level + text; images all 7 filters; links type/rel/sort/search — counts update.
- [ ] Highlight headings: toggles outlines on/off; closing popup leaves no markers after second toggle.
- [ ] Exports: JSON parses; links/images/findings CSVs open with headers; HTML report prints; filenames `sitescope-<host>-YYYYMMDD-HHmm.*`; query warning appears when URL has `?`.
- [ ] Robots.txt: click → permission prompt → allow shows file (or HTTP status note); deny shows `denied` state and fetches nothing.
- [ ] Responsive: preset opens sized window; custom W/H works; guidance text accurate.
- [ ] Settings: theme/dark-light-system applies; thresholds change re-analysis warnings; history opt-in stores ≤ limit without queries; Clear + Reset work.
- [ ] Keyboard: Tab reaches Analyze, tabs, filters, exports; focus visible; screen-reader labels announce counts/status.
- [ ] Permissions audit: manifest lists only `activeTab, scripting, storage` + optional hosts; CSP present; no network calls in Network panel except optional robots.txt.
- [ ] Large page: 5k+ node fixture → completes without freezing (tables cap at 300/400 rows, CSV full).
- [ ] Cross-browser: repeat install→analyze→export on each available browser; record per-browser results (never infer Firefox from Chrome).
