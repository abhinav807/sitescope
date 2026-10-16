# SiteScope 1.0.2 — Release Notes

## What it is

SiteScope is a free, private, no-account website inspector: one click reports SEO
metadata, headings, social tags, structured data, images, links, indexing
signals, and technical configuration — computed locally in your browser.
No backend, no telemetry, no ads.

Made and designed by Abhinav Goyal and GoldenHour Delhi.

## Highlights since 1.0.1

- Product identity: consistent creator attribution (popup, dashboard, Settings),
  copyright line, HTML author metadata, and NOTICE.md with an accurate
  third-party license table.
- New dashboard Support tab: voluntary "Buy Me a Chai" section with a locally
  bundled UPI QR (offline, never auto-pays), contact details, and About info.
  No new permissions, no external requests.
- Security hardening: CSV formula-injection mitigation on all export paths,
  runtime message/response validation with size caps, and strict validation of
  persisted settings/history (56/56 unit tests green).
- Real-browser harness: 20 PASS / 0 FAIL on Chromium, Brave, Edge, and Opera.

## Install (unpacked, direct distribution — not on any store)

Chrome/Edge/Brave/Opera → developer mode → Load unpacked → `dist/<browser>`.
Firefox → `about:debugging` → Load Temporary Add-on → `dist/firefox/manifest.json`.
Full beginner instructions: README.md in this repository.

## Verify the packages

```
SHA-256 (2026-10-16 release gate):
sitescope-chrome.zip   B7C8A144E98056A49DE7D66A4539DF970C670B4F27468757DF4A0E4E4ABFC7A7
sitescope-firefox.zip  778A20F2A249719DCDDF0EB774CD653BAD7AAD012139E06901A857DD76BF72B2
sitescope-edge.zip     39C6645C2B65D744F84F2026912D382019DC22F17F732B7F8C27CF9EAC2C44AA
sitescope-opera.zip    5B92F7E4A75605B7D73AF6601FAC459B2A142A3853825CE4DD181087701E3023
sitescope-brave.zip    E8F32BF5FB71A2633695979761E92673530B8688960D0753ECC8F40143DDCE93
```

Each ZIP contains `manifest.json` at its root, no sourcemaps, no secrets.

## Known limitations (honest)

- Response headers / HTTP status / redirect chains are reported as
  "could not verify" from DOM inspection by design.
- Link targets are never auto-fetched; reachability checks are manual-only.
- No LCP/INP/CLS/Lighthouse scores are invented — use PageSpeed Insights.
- Toolbar-click analysis, permission dialogs, file-save, print-to-PDF, and
  Firefox/Opera runtime still need a headed manual pass; mobile browsers are
  out of scope for 1.0.x.

Support: hello@goldenhourdelhi.co.in (maintainer: abhinavgoyal300@gmail.com).
Full verification record: `docs/RELEASE_READINESS.md`.
