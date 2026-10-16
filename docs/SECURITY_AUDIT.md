# Security & Privacy Audit — SiteScope 1.0.1 (2026-10-11 base; hardening pass 2026-10-16)

Auditor method: source grep over `src/`, manifest diff across `dist/*/manifest.json`,
production + dev `npm audit`, built-bundle URL/string inspection, and a live
network audit in real Chromium/Brave/Edge/Opera (fixture server request log, ~2000 local
hits per run, **0 external requests**). No finding below is claimed without the command
that produced it.

## 1. Data collection — PASS

- Analysis runs on-device when the user clicks Analyze. No backend, analytics SDK,
  ads SDK, AI API, or history collection exist in `src/` (grep for
  `google-analytics|segment|mixpanel|sentry|openai|api.openai` → no hits).
- No access to passwords, cookies, form values, or auth tokens: no `document.cookie`,
  `localStorage`/`sessionStorage`, `FormData`, or `input.value` reads in `src/`
  (only hits: the query-masking allowlist in `src/lib/utils/url.ts` and a UI string
  stating we never read them).
- No sensitive browser APIs: `cookies`, `history`, `bookmarks`, `identity`,
  `management`, `webRequest`, `topSites` are never called (remaining `history` hits
  are the opt-in local report-history feature backed by `storage.local`).
- Live proof: automated runs in Chromium, Brave, and Edge recorded **0 external
  network requests**; `/robots.txt` was requested **0 times** except through the
  explicit button (see §6).

## 2. Remote code & execution — PASS

- No `eval`, no `new Function`, no remote `<script>` (grep → no hits in `src/`).
- Extracted JSON-LD is `JSON.parse`d only, never executed; page strings render as
  React text with scheme allowlisting (`isSafeHref`) plus CSV/HTML escapers.
- No `innerHTML` / `dangerouslySetInnerHTML` in our code (only react-dom internals
  in the vendor bundle). CSP on all five manifests:
  `script-src 'self'; object-src 'self'`.
- Built-bundle URLs are benign: 6 curated resource links (click-to-open only),
  `https://sitescope.local/` (dummy base for relative-URL checks, never fetched),
  React error-decoder/XML-namespace constants (never fetched).

## 3. Network behavior — PASS

- Exactly ONE `fetch` in `src/`: `IndexingPanel` → `<origin>/robots.txt`, only after
  the user clicks the button AND grants a narrow `<origin>/*` optional-host
  permission. Denial yields a `denied` state with no request (verified live:
  server log 0 hits after click-deny in automation).
- External resource links (Search Console, Rich Results Test, PageSpeed, Schema.org,
  Lighthouse, Search Central) open only on click; the UI states the target may
  receive a pasted URL.

## 4. Permissions — PASS

- Required: `activeTab`, `scripting`, `storage` (minimum viable set; verified
  identical in all five manifests). Optional: `http://*/*`, `https://*/*` as
  `optional_host_permissions`, narrowed at runtime to `<origin>/*`.
- Content script is read-only except the explicitly requested, reversible heading
  highlight (attribute + `<style>` tag, removed on second toggle; verified in code,
  toggle-off path covered by `toggleHeadingHighlight`).

## 5. Exports & query hygiene — PASS

- Filenames are `sitescope-<host>-<date>.<ext>` with hosts sanitized and queries
  never included. UI/report mask sensitive query keys (`token`, `secret`, … → `••••`);
  verified by unit test + live JSON/CSV/HTML capture (filenames
  `sitescope-127.0.0.1-YYYYMMDD-HHmm.*`).
- History (opt-in, default OFF) stores origin+path only, capped ≤50, clearable.

## 6. Dependencies — PASS with notes (no action)

- Production (`--omit=dev`): **0 vulnerabilities**.
- Dev-only advisories (investigated, NOT upgraded — fixes are breaking and none of
  this code ships in `dist/`):
  - `@vitest/mocker` moderate path traversal → fix = vitest major (out of range).
  - `braces` (via tailwindcss/chokidar) high DoS → fix = tailwindcss v4 (breaking).
  - `esbuild ≤0.24.2` dev-server request forgery → pinned 0.21.5 required by Vite 5;
    dev server never exposed publicly; production bundles are static files.
- Shipped runtime is React + ReactDOM + Lucide only; `dist/` contains no test,
  dev-server, or audit-flagged code.

## 7. Privacy policy alignment — PASS

- `PRIVACY.md` / `PERMISSIONS.md` match the shipped manifests (same three
  permissions + optional hosts; same storage keys; same robots.txt flow).
- Support contacts are configured (hello@goldenhourdelhi.co.in, maintainer abhinavgoyal300@gmail.com); no placeholder addresses remain.

## 8. Unresolved / residual risks

- None in code. Residual risk is procedural: Firefox/Opera builds are
  artifact-validated only (binaries unavailable here); the toolbar-click host-grant
  path and OS-level file-save step require the documented manual pass.

## 9. Hardening pass 2026-10-16 — verified fixes vs. assumptions

Three Stage-A risks were fixed with minimal diffs. Each is VERIFIED by the
evidence stated; anything beyond that is marked as assumption/limitation.

| Risk | Fix (files) | Verified by | Assumption / limit |
| ---- | ----------- | ----------- | ------------------ |
| CSV formula injection | `neutralizeCsvFormula()` in `src/lib/utils/sanitize.ts`, applied inside `escapeCsvCell` (covers links/images/findings CSVs) | 12 new tests in `tests/csv-formula.test.ts` (triggers, quoting separation, per-path hostile content, full-row invariant); 56/56 suite green; export assertions still pass in 4 live browsers | First-character check only; Excel/Sheets/LibreOffice differ — mitigation, not universal safety proof |
| Unvalidated message payloads | `isPlausibleAnalysisResult` + 5 MB / 20k-findings caps in `parseAnalysisResponse`; `isKnownIncomingMessage` / `isValidTabId` + response guard in `src/background/background.ts` | 14 new tests in `tests/message-validation.test.ts` (malformed/oversized/invalid/valid); background wiring compiles and SW runs clean in 4 browsers | Handler-level wiring has no unit test (background module not importable in jsdom); relies on live SW smoke + typecheck |
| Untrusted persisted settings | `sanitizeSettings` / `sanitizeHistory` in `src/lib/settings.ts`, applied in `loadSettings` / `loadHistory` | New tests in `tests/storage-validation.test.ts` incl. end-to-end corrupt-payload round-trips through the real memory store; settings-persist still green in 4 browsers | Corrupt values are reset, not migrated — a downgrade path could reset exotic-but-valid future fields to defaults |

No telemetry, services, dependencies, permissions, or UI scope changed in this pass.
