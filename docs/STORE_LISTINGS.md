# Store listing drafts (do not publish verbatim until screenshots + support email are final)

## Shared

- **Name**: SiteScope — Website Inspector & SEO Analysis
- **Short (132 chars)**: Inspect any site's SEO, headings, links, images & structured data in one click. Private, local, free. No ads or accounts.
- **Category**: Developer Tools / SEO
- **Audience**: web developers, SEOs, content editors, students auditing their own sites or any public page they can already view.
- **Support**: hello@goldenhourdelhi.co.in (maintainer: abhinavgoyal300@gmail.com)
- **Privacy summary**: Runs locally; no telemetry, ads, tracking, or uploads. Settings stay in device storage. Optional robots.txt check asks first. Full policy in PRIVACY.md.
- **Permissions summary**: activeTab + scripting (analyze the page you click on), storage (settings), optional narrow host access only for robots.txt. No broad host access by default.
- **Screenshot order**: 1) popup on a real site 2) overview findings 3) headings 4) images/links tables 5) export tab. Captions must describe real behavior; no fabricated scores.

## Long description (all stores, adapt length limits)

> Understand any website's structure, SEO metadata, links, images, indexing signals and technical configuration in one click.
>
> SiteScope reads the page you are already viewing and builds a consolidated, evidence-backed report: titles and meta tags with configurable length heuristics, Open Graph/Twitter cards with a share preview, heading hierarchy, JSON-LD with safe parsing, image alt/dimension/loading checks, link classification with rel guidance, honest indexing signals (including what cannot be verified from the DOM), favicons and manifest links, HTTPS and DOM stats, a responsive sizing helper, and one-click JSON/CSV/HTML exports.
>
> Privacy-first: everything runs locally. No backend, analytics, ads, AI calls, or browsing-history collection. No backend or API key needed.
>
> Limitations, stated up front: response headers, HTTP status codes and redirect chains cannot be seen from the DOM and are reported as "could not verify"; link targets are never auto-fetched; performance scores (LCP/INP/CLS/Lighthouse) are never invented — use PageSpeed Insights for those.

## Store notes

- Chrome Web Store: single purpose = "website inspection and SEO diagnostics"; justify optional hosts in the disclosure form.
- AMO: upload the Firefox zip only; include build-from-source notes (Vite + `npm run build:firefox`).
- Edge: reuse Chrome package flow with the Edge zip.
- Opera: follow the current Opera add-ons packaging rules; reuse the same listing.
- Do not claim approval, certification, downloads, ratings, or ranking improvements.
