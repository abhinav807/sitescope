# Screenshots — genuine captures and remaining needs (SiteScope 1.0.1)

Rule: only real captures of the working extension may be used. No mockups.

## Available now (`qa-shots/`, captured 2026-10-11/15 by `scripts/verify-browser.mjs`)

All at 1280×800 viewport against the deterministic local fixture site
(`tests/fixtures/complete.html` content). Per browser (chrome, brave, edge, opera):

| File | Store slot | Status |
| ---- | ---------- | ------ |
| `<browser>-popup.png` | 1. Toolbar popup | GENUINE (shows honest unsupported-page state as-tab; re-capture headed for the Analyze-ready state) |
| `<browser>-dashboard-overview.png` | 2. Findings overview | GENUINE, store-ready |
| `<browser>-dashboard-headings.png` | 3. Headings visualizer | GENUINE, store-ready |
| `<browser>-dashboard-export.png` | 5. Export tab | GENUINE, store-ready |
| `<browser>-dashboard-support.png` | 6. Support SiteScope (chai + contacts) | GENUINE, store-ready (chrome capture shows the real owner QR; re-capture other browsers only if their fallback shots predate the QR) |

Machine-readable evidence alongside: `<browser>-results.json`, `<browser>-inject.json`.

## Still needed (manual, headed browser, real public site)

1. Popup in Analyze-ready state on a real site (slot 1 alternative).
2. Images/Links tables on a real site (slot 4).
3. Full-page capture at exactly 1280×800 for Chrome Web Store (screenshots above
   already are 1280×800 — crop to content if required).
4. Firefox + Opera captures once their manual passes run.
5. Optional: dark/light theme comparison (Settings tab).

## Never allowed

Stock photos, other extensions' screenshots, edited metrics, fabricated scores,
or approval/rating badges.
