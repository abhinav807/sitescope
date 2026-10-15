# Release checklist

1. `npm install` clean; `npm test` green; `npm run typecheck` green; `npm run build:all` green.
2. `npm run package:all` → `release/sitescope-{chrome,firefox,edge,opera,brave}.zip`; each unzips with `manifest.json` at root, no `.map`, no tests.
3. Bump `package.json` + `src/manifests/base.json` versions together; update `CHANGELOG.md`.
4. Regenerate icons if changed: `npm run icons`.
5. Fill `docs/STORE_LISTINGS.md` placeholders (support email, screenshots from the real build).
6. Privacy review: `PRIVACY.md` + `PERMISSIONS.md` match the shipped manifest (diff them).
7. Per-store submission:
   - **Chrome Web Store**: Developer Dashboard → New item → upload `sitescope-chrome.zip`; category Developer Tools; declare `activeTab/scripting/storage` + optional hosts justification; single-purpose description; screenshots 1280×800.
   - **Firefox (AMO)**: Submit `sitescope-firefox.zip` (source + build notes; AMO may ask for sources); same disclosures; gecko id reserved.
   - **Edge Add-ons**: Partner Center → upload `sitescope-edge.zip`; reuse Chrome listing.
   - **Opera**: Opera add-ons → upload `sitescope-opera.zip` per current requirements.
   - Brave/Vivaldi: no separate store — document “install Chromium build via developer mode / Chrome Web Store”.
8. Never claim approval, certification, ratings, or rankings. Screenshot order: popup → overview → headings → images/links → export.
9. Tag `vX.Y.Z`, attach zips to the GitHub release, paste listing text from `docs/STORE_LISTINGS.md`.
