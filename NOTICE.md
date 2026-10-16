# Notices for SiteScope

## Product identity

**SiteScope** is the claimed (unregistered) product name of this project. No
registration is claimed and no ® or ™ symbol is used. "Inspect. Understand.
Improve." is the project tagline.

Copyright © 2026 Abhinav Goyal and GoldenHour Delhi. All rights reserved.

Made and designed by Abhinav Goyal and GoldenHour Delhi.

## Project license

The original SiteScope source code, interface design, and documentation are
licensed under the MIT License — see `LICENSE`. The full license text governs;
nothing in this notice adds restrictions beyond it.

## Third-party components

This project does not claim ownership of third-party software. Each component
keeps its own license:

| Component | License | Role |
| --------- | ------- | ---- |
| React, ReactDOM | MIT | Shipped runtime (UI) |
| lucide-react | ISC | Shipped runtime (icons) |
| Vite, @vitejs/plugin-react | MIT | Build tooling (not shipped) |
| Tailwind CSS, PostCSS, Autoprefixer | MIT | Styling toolchain (not shipped) |
| TypeScript | Apache-2.0 | Language toolchain (not shipped) |
| Vitest, jsdom, @types/* | MIT | Test toolchain (not shipped) |
| esbuild | MIT | Bundler for content/background scripts (not shipped) |
| archiver | MIT | Release ZIP packaging (not shipped) |
| web-ext | MPL-2.0 | Firefox validation (not shipped) |
| playwright, playwright-core | Apache-2.0 | Browser verification (not shipped) |

Only React, ReactDOM, and lucide-react end up in the production extension
bundles. Refer to each package's own license file in `node_modules/` for terms.

## Owner-supplied assets

The UPI QR image (`public/support/upi-qr.png`) is supplied by the project owner
and is **not** covered by the MIT license above — all rights reserved by its
owner. It is bundled locally with the extension and never transmitted anywhere.
