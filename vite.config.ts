import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Browser target passed via --mode <browser>. Defaults to chrome.
// Generates a valid MV3 (chromium) or Firefox-adapted manifest per target.
const VALID_MODES = ['chrome', 'firefox', 'edge', 'opera', 'brave'] as const;
type BrowserTarget = (typeof VALID_MODES)[number];

function targetFromMode(mode: string): BrowserTarget {
  return (VALID_MODES as readonly string[]).includes(mode)
    ? (mode as BrowserTarget)
    : 'chrome';
}

export default defineConfig(({ mode }) => {
  const target = targetFromMode(mode);
  const isFirefox = target === 'firefox';

  return {
    base: './',
    plugins: [
      react(),
      {
        name: 'sitescope-manifest',
        closeBundle() {
          const outDir = resolve(__dirname, `dist/${target}`);
          try {
            const baseRaw = readFileSync(resolve(__dirname, 'src/manifests/base.json'), 'utf-8');
            const base = JSON.parse(baseRaw);
            let override: Record<string, unknown> = {};
            const overridePath = resolve(__dirname, `src/manifests/${target}.json`);
            if (existsSync(overridePath)) {
              override = JSON.parse(readFileSync(overridePath, 'utf-8'));
            }
            // Deep-merge top-level keys (override wins; background/action merged shallowly)
            const merged: Record<string, unknown> = { ...base, ...override };
            if (base.background || override.background) {
              merged.background = { ...(base.background as object ?? {}), ...(override.background as object ?? {}) };
            }
            // Firefox uses classic background.scripts (our bundle is IIFE, no
            // modules needed); drop Chromium's service_worker AND type so the
            // minimum version stays 109 instead of requiring 112+ (web-ext lint).
            if (target === 'firefox' && merged.background && typeof merged.background === 'object') {
              delete (merged.background as Record<string, unknown>).service_worker;
              delete (merged.background as Record<string, unknown>).type;
              delete (merged.background as Record<string, unknown>).minimum_chrome_version;
            }
            if (target === 'firefox') delete (merged as Record<string, unknown>).minimum_chrome_version;
            if (base.action || override.action) {
              merged.action = { ...(base.action as object ?? {}), ...(override.action as object ?? {}) };
            }
            mkdirSync(outDir, { recursive: true });
            writeFileSync(resolve(outDir, 'manifest.json'), JSON.stringify(merged, null, 2));
            // Ensure icon PNGs exist in output
            const iconsSrc = resolve(__dirname, 'public/icons');
            const iconsDst = resolve(outDir, 'icons');
            if (existsSync(iconsSrc)) {
              mkdirSync(iconsDst, { recursive: true });
              cpSync(iconsSrc, iconsDst, { recursive: true });
            }
          } catch (err) {
            console.warn('[sitescope-manifest] failed to write manifest:', err);
          }
          // Firefox cannot use service_worker-only background in all versions:
          // our firefox.json override already swaps to scripts. Log target for clarity.
          if (isFirefox) console.log('[sitescope] built Firefox-compatible manifest (background.scripts + gecko settings)');
          else console.log(`[sitescope] built Chromium MV3 manifest for ${target}`);
        },
      },
    ],
    root: resolve(__dirname, 'src'),
    publicDir: resolve(__dirname, 'public'),
    build: {
      outDir: resolve(__dirname, `dist/${target}`),
      emptyOutDir: true,
      sourcemap: false,
      minify: 'esbuild',
      rollupOptions: {
        // NOTE: extension *pages* only. content/background are bundled separately
        // as single-file classic scripts via scripts/bundle-workers.mjs because
        // scripting.executeScript({ files }) cannot inject ES modules.
        input: {
          popup: resolve(__dirname, 'src/popup/popup.html'),
          dashboard: resolve(__dirname, 'src/dashboard/dashboard.html'),
          sidepanel: resolve(__dirname, 'src/sidepanel/sidepanel.html'),
        },
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
    },
  };
});
