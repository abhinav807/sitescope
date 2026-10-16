# SiteScope 1.0.1 — Release Notes (draft body for the GitHub Release)

> Do not publish this release until the manual QA pass in
> `docs/QA_EXECUTION_SHEET.md` is complete. Nothing here has been submitted to
> any browser store.

## What it is

SiteScope is a free, private, no-account website inspector: one click reports SEO
metadata, headings, social tags, structured data, images, links, indexing
signals, and technical configuration — computed locally in your browser.
No backend, no telemetry, no ads.

## Highlights since 1.0.0

- Fixed critical packaging bug: the content script shipped as an ES module and
  could not be injected (`scripts/bundle-workers.mjs` now emits single-file
  classic scripts with a build-time gate).
- Fixed Firefox messaging interop (dual callback/promise handling + 5 tests).
- Firefox manifest tuned (`web-ext lint`: 0 errors).
- Real-browser harness (`npm run verify:chrome|edge|brave|opera`): 20 PASS /
  0 FAIL on Chromium, Brave, Edge, and Opera.

## Install (unpacked, until store listings go live)

Chrome/Edge/Brave/Opera → developer mode → Load unpacked → `dist/<browser>`.
Firefox → `about:debugging` → Load Temporary Add-on → `dist/firefox/manifest.json`.

## Verify the packages

```
SHA-256 (2026-10-15 final gate):
sitescope-chrome.zip   AB988A39DFFCA159EA0C98EE645D13159E3F80A1C73D1E0802F743FA8131D89E
sitescope-firefox.zip  D691F4DDE13C686A68438F6DAC4578EF6C9F0EBE9E061B8A0F845A5083224C1D
sitescope-edge.zip     14EBF4FDD638775DEBA7B9843C827AC95CA926B866473F17DA455C809CFF5BEF
sitescope-opera.zip    86B076D29BD99BEC682F15C0FE2B88D3CBE52448E4CCDB7FF924891F223D3295
sitescope-brave.zip    080AD47EAF8FAFEEAC35F0E5B1775698EF3A3893447618BB6C61305ED9D9C142
```

Each ZIP contains `manifest.json` at its root, no sourcemaps, no secrets.

## Known limitations (honest)

- Response headers / HTTP status / redirect chains are reported as
  "could not verify" from DOM inspection by design.
- Link targets are never auto-fetched; reachability checks are manual-only.
- No LCP/INP/CLS/Lighthouse scores are invented — use PageSpeed Insights.
- Firefox and Opera need a full manual install→export pass (see QA sheet);
  mobile browsers are out of scope for 1.0.1.

Support: hello@goldenhourdelhi.co.in (maintainer: abhinavgoyal300@gmail.com).
Full verification record: `docs/RELEASE_READINESS.md`.
