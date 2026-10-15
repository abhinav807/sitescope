# Contributing

Thanks for considering a contribution to SiteScope.

## Ground rules

- Original code only. Do not paste other extensions' source, artwork, or copy.
- No telemetry, ads, tracking, remote AI, or new broad permissions without a design discussion.
- Core analysis must stay deterministic, local, and test-covered (add/update fixtures in `tests/fixtures/`).
- Every interactive control must work; no mock data as real results; no fake exports.

## Workflow

1. Fork / branch from `main`.
2. `npm install`, `npm test`, `npm run typecheck`.
3. Add tests for analyzers or UI behavior you change.
4. `npm run build:all` and `npm run package:all` must pass.
5. Update `CHANGELOG.md` (Unreleased section) and relevant docs.
6. Open a PR describing behavior, limitations, and manual QA performed (see `docs/QA_CHECKLIST.md`).

## Code style

- TypeScript strict, React function components, Tailwind + CSS variables.
- All browser differences go in `src/lib/browser/*` (feature detection, not UA sniffing).
- Treat page content as untrusted: escape, allowlist URL schemes, never `eval`.
