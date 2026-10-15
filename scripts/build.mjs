/**
 * Cross-browser build + package orchestrator.
 * Usage:
 *   node scripts/build.mjs --browser chrome        (single build via vite --mode)
 *   node scripts/build.mjs --all                   (all five targets)
 *   node scripts/build.mjs --all --zip             (also produce release/*.zip)
 *
 * Each target gets dist/<browser>/ with its own manifest.json at the root.
 * ZIPs contain only production files (no sourcemaps, tests, or node_modules).
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TARGETS = ['chrome', 'firefox', 'edge', 'opera', 'brave'];

const args = process.argv.slice(2);
const wantZip = args.includes('--zip');
const wantAll = args.includes('--all');
const single = args.find((a) => a.startsWith('--browser='));

function run(cmd) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: ROOT });
}

function targets() {
  if (single) {
    const t = single.split('=')[1];
    if (!TARGETS.includes(t)) throw new Error(`Unknown browser: ${t}`);
    return [t];
  }
  if (wantAll) return TARGETS;
  return ['chrome'];
}

async function zipDir(srcDir, outZip) {
  const { default: archiver } = await import('archiver');
  const { createWriteStream } = await import('node:fs');
  mkdirSync(dirname(outZip), { recursive: true });
  await new Promise((res, rej) => {
    const out = createWriteStream(outZip);
    const ar = archiver('zip', { zlib: { level: 9 } });
    out.on('close', () => res());
    ar.on('error', rej);
    ar.pipe(out);
    // Only ship what's needed at archive root
    ar.glob('**/*', { cwd: srcDir, dot: false, ignore: ['*.map'] });
    ar.finalize();
  });
  console.log(`packaged ${outZip}`);
}

function validateDist(t) {
  const dir = resolve(ROOT, `dist/${t}`);
  if (!existsSync(resolve(dir, 'manifest.json'))) throw new Error(`dist/${t}/manifest.json missing`);
  for (const f of ['popup/popup.html', 'dashboard/dashboard.html', 'sidepanel/sidepanel.html', 'background.js', 'content.js']) {
    if (!existsSync(resolve(dir, f))) throw new Error(`dist/${t}/${f} missing`);
  }
  const files = readdirSync(dir);
  console.log(`[validate:${t}] ok —`, files.join(', '));
  // Fail if sourcemaps leaked
  const flat = [];
  (function walk(d) {
    for (const e of readdirSync(d)) {
      const p = resolve(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else flat.push(p);
    }
  })(dir);
  const maps = flat.filter((f) => f.endsWith('.map'));
  if (maps.length) throw new Error(`Sourcemaps leaked into dist/${t}: ${maps.join(', ')}`);
}

const list = targets();
for (const t of list) {
  run(`npx vite build --mode ${t}`);
  run(`node scripts/bundle-workers.mjs --browser=${t}`);
  validateDist(t);
}

if (wantZip) {
  mkdirSync(resolve(ROOT, 'release'), { recursive: true });
  const pkg = JSON.parse((await import('node:fs')).readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
  void pkg;
  for (const t of list) {
    await zipDir(resolve(ROOT, `dist/${t}`), resolve(ROOT, `release/sitescope-${t}.zip`));
  }
  console.log('All packages written to release/');
}
