/**
 * Bundles content + background entry points as SINGLE-FILE classic scripts.
 *
 * Why: `chrome.scripting.executeScript({ files: [...] })` (and the Firefox
 * equivalent) cannot inject ES modules — Vite's default code-splitting emits
 * `content.js` with `import ... from "./assets/..."`, which throws a
 * SyntaxError on injection and breaks analysis on every page.
 * Extension *pages* (popup/dashboard) keep ESM (fully supported there);
 * only the injected content script and the background worker are bundled here.
 *
 * Usage: node scripts/bundle-workers.mjs --browser=chrome | --all
 */
import * as esbuild from 'esbuild';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TARGETS = ['chrome', 'firefox', 'edge', 'opera', 'brave'];

const args = process.argv.slice(2);
const list = args.includes('--all')
  ? TARGETS
  : [args.find((a) => a.startsWith('--browser='))?.split('=')[1] ?? 'chrome'];

for (const t of list) {
  if (!TARGETS.includes(t)) throw new Error(`Unknown browser: ${t}`);
  await esbuild.build({
    entryPoints: [resolve(ROOT, 'src/content/content.ts')],
    bundle: true,
    format: 'iife',
    minify: true,
    sourcemap: false,
    target: 'es2020',
    outfile: resolve(ROOT, `dist/${t}/content.js`),
    logLevel: 'warning',
  });
  await esbuild.build({
    entryPoints: [resolve(ROOT, 'src/background/background.ts')],
    bundle: true,
    format: 'iife',
    minify: true,
    sourcemap: false,
    target: 'es2020',
    outfile: resolve(ROOT, `dist/${t}/background.js`),
    logLevel: 'warning',
  });
  // Regression gate: injected files must be classic scripts (no ESM import/export,
  // no relative chunk imports). Fail loudly so this never ships broken again.
  for (const f of [`dist/${t}/content.js`, `dist/${t}/background.js`]) {
    const src = readFileSync(resolve(ROOT, f), 'utf-8');
    const offenders = [
      /^[ \t]*import[\s({*"]/m.test(src) ? 'import-statement' : null,
      /^[ \t]*export\s/m.test(src) ? 'export-statement' : null,
      /from\s*["']\.\//.test(src) ? 'relative-chunk-import' : null,
    ].filter(Boolean);
    if (offenders.length) throw new Error(`${f} looks like an ES module (${offenders.join(', ')}). Injection would fail.`);
  }
  console.log(`[workers:${t}] content.js + background.js bundled as single-file classic scripts`);
}
