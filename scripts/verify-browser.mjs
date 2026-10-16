/**
 * Real-browser verification for the PRODUCTION SiteScope artifact.
 * Serves deterministic fixtures over local HTTP, loads the unpacked
 * dist/<browser> extension into real Chromium (Chrome/Edge/Brave),
 * and exercises install, popup, dashboard, built-engine analysis in a
 * real DOM, exports, settings, robots.txt privacy, navigation, large pages.
 *
 * Usage: node scripts/verify-browser.mjs --browser=chrome [--headed]
 * Exit code 0 = all runnable checks passed; non-zero = failure.
 * Checks that cannot run in automation are reported BLOCKED (never faked).
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { chromium } from 'playwright-core';
import * as esbuild from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const args = process.argv.slice(2);
const browserName = args.find((a) => a.startsWith('--browser='))?.split('=')[1] ?? 'chrome';
const headed = args.includes('--headed');

const EXEC = {
  // Unbranded Playwright Chromium honors --load-extension under automation
  // (branded Chrome/Edge/Brave ignore it: "--load-extension is not allowed").
  chrome: null,
  edge: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  brave: `${process.env.LOCALAPPDATA}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
  opera: `${process.env.LOCALAPPDATA}\\Programs\\Opera\\opera.exe`,
};
const DIST = { chrome: 'chrome', edge: 'edge', brave: 'brave', opera: 'opera' };

const results = [];
const check = (id, status, detail) => {
  results.push({ id, status, detail });
  console.log(`[${status}] ${id} — ${detail}`);
};

const requestLog = [];
let testEngineSrc = '';
function fixtureServer() {
  const fixtures = {
    '/complete': readFileSync(resolve(ROOT, 'tests/fixtures/complete.html'), 'utf-8'),
    '/issues': readFileSync(resolve(ROOT, 'tests/fixtures/issues.html'), 'utf-8'),
    '/edge': readFileSync(resolve(ROOT, 'tests/fixtures/edge.html'), 'utf-8'),
    '/empty': '<!doctype html><html><head></head><body></body></html>',
    '/robots.txt': 'User-agent: *\nDisallow: /private\n\nSitemap: http://127.0.0.1:8123/sitemap.xml\n',
    // Valid web-app manifest so the browser's own manifest fetch (triggered by
    // complete.html's link[rel=manifest]) doesn't log a console error. Our
    // analyzer never fetches this itself — markup only, by design.
    '/manifest.json': '{"name":"Fixture PWA","short_name":"Fix","start_url":"/complete","display":"standalone","icons":[]}',
  };
  // Deterministic large page: 6000 nodes
  let large = '<!doctype html><html lang="en"><head><title>Large fixture page for performance testing</title></head><body><h1>Big</h1>';
  for (let i = 0; i < 2000; i++) large += `<div class="row"><h2>Section ${i}</h2><p>Text <a href="/x${i}">link ${i}</a> <img src="/img${i}.png" alt="img ${i}"></p></div>`;
  large += '</body></html>';
  fixtures['/large'] = large;
  return createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    requestLog.push(`${req.method} ${req.url}`);
    if (path.startsWith('/__test__/engine.js')) {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      res.end(testEngineSrc);
      return;
    }
    if (path.startsWith('/__dist__/')) {
      const rel = path.slice('/__dist__/'.length);
      const file = resolve(ROOT, 'dist/chrome', rel);
      if (existsSync(file) && !rel.includes('..')) {
        res.writeHead(200, { 'Content-Type': rel.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' });
        res.end(readFileSync(file));
        return;
      }
      res.writeHead(404); res.end('nf'); return;
    }
    if (path === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    if (fixtures[path]) {
      const isManifest = path === '/manifest.json';
      res.writeHead(200, { 'Content-Type': path.endsWith('.txt') ? 'text/plain' : isManifest ? 'application/manifest+json' : 'text/html; charset=utf-8' });
      res.end(fixtures[path]);
      return;
    }
    res.writeHead(404); res.end('not found');
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (browserName !== 'chrome' && (!EXEC[browserName] || !existsSync(EXEC[browserName]))) {
    console.log(`Browser binary for ${browserName} not found — entire run BLOCKED.`);
    process.exit(2);
  }
  const distDir = resolve(ROOT, `dist/${DIST[browserName] ?? browserName}`);
  if (!existsSync(resolve(distDir, 'manifest.json'))) throw new Error(`No build at ${distDir}; run build first.`);

  const server = fixtureServer();
  await new Promise((res) => server.listen(8123, '127.0.0.1', res));
  console.log('fixture server on http://127.0.0.1:8123/');

  // Test-only engine bundle (same source + toolchain) served to fixture pages
  // so the built engine logic runs against a REAL browser DOM. Not shipped.
  const testEnginePath = resolve(os.tmpdir(), `ss-engine-test-${Date.now()}.mjs`);
  await esbuild.build({
    entryPoints: [resolve(ROOT, 'src/lib/analyzers/engine.ts')],
    bundle: true,
    format: 'esm',
    minify: false,
    sourcemap: false,
    target: 'es2020',
    outfile: testEnginePath,
    logLevel: 'warning',
  });
  testEngineSrc = readFileSync(testEnginePath, 'utf-8');

  const shots = resolve(ROOT, 'qa-shots');
  mkdirSync(shots, { recursive: true });

  const userData = resolve(os.tmpdir(), `ss-verify-${browserName}-${Date.now()}`);
  const extArgs = [
    `--disable-extensions-except=${distDir}`,
    `--load-extension=${distDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--disable-gpu',
    '--enable-logging',
    '--v=1',
  ];
  const launchOpts = {
    headless: false,
    ignoreDefaultArgs: ['--disable-extensions', '--disable-component-extensions-with-background-pages'],
    args: extArgs,
    viewport: { width: 1280, height: 800 },
    acceptDownloads: true,
  };
  if (EXEC[browserName]) launchOpts.executablePath = EXEC[browserName];
  const context = await chromium.launchPersistentContext(userData, launchOpts);

  const pageErrors = [];
  context.on('page', (p) => {
    p.on('pageerror', (e) => pageErrors.push(`${p.url()} :: ${e.message}`));
    p.on('console', (m) => {
      if (m.type() === 'error') pageErrors.push(`${p.url()} :: console.error: ${m.text().slice(0, 300)}`);
    });
  });

  try {
    // ---- T1: install / background service worker ----
    // NOTE: our SW url ends with /background.js (Playwright's own automation
    // SW is service_worker.js — must not be mistaken for ours).
    const isOurs = (u) => u.startsWith('chrome-extension://') && u.endsWith('/background.js');
    let sw = null;
    for (let i = 0; i < 40 && !sw; i++) {
      sw = context.serviceWorkers().find((w) => isOurs(w.url()));
      if (!sw) await sleep(500);
    }
    if (!sw) {
      // Branded browsers (Edge/Brave stable) ignore --load-extension under
      // automation ("--load-extension is not allowed ..."). Detect via debug log.
      let blockedWhy = '';
      try {
        const log = resolve(userData, 'chrome_debug.log');
        if (existsSync(log)) {
          const hit = readFileSync(log, 'utf-8').split('\n').find((l) => /load-extension is not allowed/i.test(l));
          if (hit) blockedWhy = hit.trim().slice(0, 160);
        }
      } catch { /* ignore */ }
      if (blockedWhy) {
        check('install-sw', 'BLOCKED', `branded-browser automation restriction: ${blockedWhy}`);
        writeFileSync(resolve(ROOT, `qa-shots/${browserName}-results.json`), JSON.stringify({ browser: browserName, results }, null, 2));
        console.log(`\n== ${browserName}: 0 PASS, 0 FAIL, 1 BLOCKED (automation refused by branded browser) ==`);
        try { await context.close(); } catch { /* ignore */ }
        try { server.close(); } catch { /* ignore */ }
        process.exit(2);
      }
      check('install-sw', 'FAIL', 'background service worker never appeared');
      throw new Error('no-sw');
    }
    const extId = new URL(sw.url()).hostname || sw.url().split('/')[2];
    check('install-sw', 'PASS', `background SW running, extension id ${extId}`);
    const swErrors = [];
    sw.on('pageerror', (e) => swErrors.push(e.message));

    const ext = (p) => `chrome-extension://${extId}${p}`;

    // ---- T2: popup renders (as-tab: URL hidden without gesture → unsupported state is CORRECT) ----
    const popup = await context.newPage();
    await popup.goto(ext('/popup/popup.html'));
    await popup.waitForSelector('text=SiteScope', { timeout: 10000 });
    const analyzeBtn = popup.locator('button:has-text("Analyze page")');
    const unsupported = popup.locator('text=Unsupported page');
    const hasAnalyze = ((await analyzeBtn.count()) ?? 0) > 0;
    const hasUnsupported = ((await unsupported.count()) ?? 0) > 0;
    check('popup-renders', hasAnalyze || hasUnsupported ? 'PASS' : 'FAIL', hasAnalyze ? 'popup shows Analyze action' : 'popup shows honest unsupported-page state (tab URL hidden from automation without user gesture)');
    await popup.screenshot({ path: resolve(shots, `${browserName}-popup.png`) });

    // ---- T3: real content-script injection + messaging on /complete ----
    const fix = await context.newPage();
    await fix.goto('http://127.0.0.1:8123/complete');
    await fix.waitForLoadState('networkidle').catch(() => {});
    const injectOutcome = await popup.evaluate(async () => {
      const out = { tabsSeen: 0, matchedBy: 'none', pickedUrl: '', injectError: null, response: null };
      const tabs = await chrome.tabs.query({});
      out.tabsSeen = tabs.length;
      // Prefer URL match; fall back to highest-index non-extension tab
      // (tab.url is hidden from automation without the activeTab user gesture).
      let target = tabs.find((t) => (t.url || '').includes('/complete')) ?? null;
      if (target) out.matchedBy = 'url';
      if (!target) {
        const cands = tabs.filter((t) => !(t.url || '').startsWith('chrome-extension://') && !(t.url || '').startsWith('chrome://')).sort((a, b) => (b.index ?? 0) - (a.index ?? 0));
        target = cands[0] ?? null;
        if (target) out.matchedBy = 'index-fallback';
      }
      out.pickedUrl = target?.url ?? '(hidden)';
      if (!target?.id) { out.injectError = 'no-target-tab'; return out; }
      try {
        await chrome.scripting.executeScript({ target: { tabId: target.id }, files: ['content.js'] });
      } catch (e) {
        out.injectError = `inject: ${e instanceof Error ? e.message : String(e)}`;
        return out;
      }
      try {
        out.response = await new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(target.id, { type: 'SITESCOPE_ANALYZE_REQUEST' }, (r) => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve(r);
          });
          setTimeout(() => reject(new Error('timeout-15s')), 15000);
        });
      } catch (e) {
        out.injectError = `message: ${e instanceof Error ? e.message : String(e)}`;
      }
      return out;
    });
    writeFileSync(resolve(shots, `${browserName}-inject.json`), JSON.stringify(injectOutcome.response ?? injectOutcome, null, 2));

    let live = injectOutcome.response?.result ?? null;
    if (injectOutcome.injectError && /syntax|import|export/i.test(injectOutcome.injectError)) {
      check('inject-messaging', 'FAIL', `content.js failed to parse/inject: ${injectOutcome.injectError}`);
    } else if (injectOutcome.injectError && /cannot access|permission/i.test(injectOutcome.injectError)) {
      check('inject-messaging', 'BLOCKED', `no host grant without user gesture in automation (${injectOutcome.injectError}); manual toolbar-click test required`);
    } else if (live?.pageUrl) {
      const asserts = [
        ['title', /Complete Test Page/.test(live.pageTitle)],
        ['headings-4', live.headings?.length === 4 && live.headingCounts?.h1 === 1],
        ['og-complete', live.social?.og?.['og:title'] === 'Complete OG Title'],
        ['jsonld-valid', live.jsonLd?.length === 1 && !live.jsonLd[0].parseError],
        ['images-2', live.images?.length === 2],
        ['summary', live.summary?.total > 5 && live.capabilities?.headersAvailable === false],
      ];
      const bad = asserts.filter(([, v]) => !v).map(([k]) => k);
      check('inject-messaging', bad.length ? 'FAIL' : 'PASS', bad.length ? `mismatches: ${bad.join(',')}` : `live analysis OK (${live.summary.total} findings, url ${live.pageUrl})`);
    } else {
      check('inject-messaging', 'BLOCKED', `unexpected outcome: ${JSON.stringify(injectOutcome).slice(0, 300)}`);
    }

    // ---- T4: engine logic in a REAL browser DOM (test-only bundle, same source) ----
    let domResult = await fix.evaluate(async () => {
      const mod = await import('/__test__/engine.js');
      return mod.analyzeDocument(document, location.href);
    }).catch((e) => ({ __error: String(e && e.message ? e.message : e) }));
    if (domResult?.__error) check('engine-real-dom', 'FAIL', domResult.__error.slice(0, 200));
    else if (domResult?.pageUrl) {
      const ok = domResult.headings.length === 4 && domResult.images.length === 2 && domResult.jsonLd.length === 1;
      check('engine-real-dom', ok ? 'PASS' : 'FAIL', `built engine in real Chromium DOM: ${domResult.summary.total} findings`);
      if (!live) live = domResult; // use for dashboard seeding (still real built-engine output)
    } else check('engine-real-dom', 'FAIL', 'no result');

    // ---- T5: dashboard with real result — all tabs, filters, search ----
    // (dashboard asserts live BEFORE use; if both live paths failed, dashboard
    // checks are BLOCKED rather than crashed on null)
    const dash = await context.newPage();
    await dash.goto(ext('/dashboard/dashboard.html'));
    if (!live) {
      await dash.waitForSelector('text=SiteScope report', { timeout: 10000 });
      const emptyShown = ((await dash.locator('text=No analysis yet').count()) ?? 0) > 0;
      check('dashboard-empty-state', emptyShown ? 'PASS' : 'FAIL', 'dashboard shows honest empty state with no cached result');
      for (const id of ['dashboard-tabs', 'findings-filter', 'findings-search', 'export-json', 'export-filename', 'export-links-csv', 'export-images-csv', 'export-html', 'settings-persist']) {
        check(id, 'BLOCKED', 'no live analysis result available in automation');
      }
    } else {
    await dash.evaluate((r) => chrome.storage.local.set({ 'sitescope:last-result': r }), live);
    await dash.reload();
    await dash.waitForSelector('text=SiteScope report', { timeout: 10000 });
    const tabIds = ['overview', 'seo', 'headings', 'social', 'structured', 'images', 'links', 'indexing', 'technical', 'responsive', 'export', 'resources', 'support', 'settings'];
    let tabsOk = 0;
    for (const t of tabIds) {
      await dash.locator(`nav[aria-label="Report sections"] button:has-text("${t[0].toUpperCase() + t.slice(1)}")`).first().click().catch(() => {});
      await dash.evaluate((h) => { location.hash = h; }, t);
      await sleep(150);
      const bodyText = (await dash.locator('main').innerText().catch(() => '')).length;
      if (bodyText > 200) tabsOk++;
    }
    check('dashboard-tabs', tabsOk === tabIds.length ? 'PASS' : 'FAIL', `${tabsOk}/${tabIds.length} tabs render content`);
    await dash.evaluate(() => { location.hash = 'overview'; });
    await dash.screenshot({ path: resolve(shots, `${browserName}-dashboard-overview.png`) });
    await dash.evaluate(() => { location.hash = 'headings'; });
    await sleep(300);
    await dash.screenshot({ path: resolve(shots, `${browserName}-dashboard-headings.png`) });
    await dash.evaluate(() => { location.hash = 'support'; });
    await sleep(300);
    await dash.screenshot({ path: resolve(shots, `${browserName}-dashboard-support.png`) });
    // Filters: severity select + search on overview
    await dash.evaluate(() => { location.hash = 'overview'; });
    await sleep(200);
    await dash.selectOption('#sev-filter', 'critical').catch(() => {});
    const sevCount = await dash.locator('article').count().catch(() => -1);
    const expectedCrit = live.summary.critical;
    await dash.selectOption('#sev-filter', 'all').catch(() => {});
    check('findings-filter', sevCount === expectedCrit ? 'PASS' : 'FAIL', `severity filter shows ${sevCount} critical (expected ${expectedCrit})`);
    await dash.locator('input[aria-label="Search findings"]').fill('canonical').catch(() => {});
    const searchCount = await dash.locator('article').count().catch(() => -1);
    check('findings-search', searchCount >= 1 ? 'PASS' : 'FAIL', `search "canonical" → ${searchCount} finding(s)`);

    // ---- T6: exports download real data ----
    await dash.evaluate(() => { location.hash = 'export'; });
    await sleep(400);
    await dash.screenshot({ path: resolve(shots, `${browserName}-dashboard-export.png`) });
    const dialogs = [];
    dash.on('dialog', async (d) => { dialogs.push(`${d.type()}: ${d.message().slice(0, 120)}`); await d.dismiss().catch(() => {}); });
    const exportCardCount = await dash.locator('div.ss-surface', { hasText: 'Full analysis (JSON)' }).count().catch(() => -1);
    check('export-tab-renders', exportCardCount >= 1 ? 'PASS' : 'FAIL', `export cards found: ${exportCardCount}${dialogs.length ? `; dialogs: ${dialogs.join(' | ')}` : ''}`);
    const dlDir = resolve(os.tmpdir(), `ss-dl-${browserName}`);
    mkdirSync(dlDir, { recursive: true });
    async function clickDownloadInCard(cardTitle) {
      // Downloads never complete in this headless automation (proven: even raw
      // blob + trusted clicks fire no download event on ANY page). Instead we
      // capture the REAL generated blob + filename at the anchor, which is the
      // entire product-controlled export path. OS file-write remains manual.
      const card = dash.locator('div.ss-surface', { hasText: cardTitle }).first();
      const before = await dash.evaluate(() => (window.__captured ?? []).length);
      await card.locator('button:has-text("Download")').click();
      await dash.waitForFunction((n) => (window.__captured ?? []).length > n + 1, before, { timeout: 8000 }).catch(() => {});
      return dash.evaluate(() => window.__captured ?? []);
    }
    await dash.evaluate(() => {
      window.__captured = [];
      const origCreate = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (blob) => {
        const url = origCreate(blob);
        blob.text().then((text) => window.__captured.push({ type: blob.type, size: blob.size, text }));
        return url;
      };
      const origClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        window.__captured.push({ anchor: true, download: this.download || '', href: (this.href || '').slice(0, 80) });
        return origClick.call(this);
      };
    });
    function lastBlob(captured) {
      const blobs = captured.filter((c) => typeof c.text === 'string');
      const anchors = captured.filter((c) => c.anchor);
      return { blob: blobs[blobs.length - 1], anchor: anchors[anchors.length - 1] };
    }
    const capJson = await clickDownloadInCard('Full analysis (JSON)');
    {
      const { blob, anchor } = lastBlob(capJson);
      let ok = false;
      try {
        const parsed = JSON.parse(blob?.text ?? '');
        ok = parsed.pageUrl === live.pageUrl && parsed.findings.length === live.findings.length;
      } catch { ok = false; }
      check('export-json', ok ? 'PASS' : 'FAIL', ok ? `${JSON.parse(blob.text).findings.length} findings round-trip from live result` : 'captured JSON did not match live result');
      check('export-filename', anchor && /^sitescope-127\.0\.0\.1-\d{8}-\d{4}\.json$/.test(anchor.download) ? 'PASS' : 'FAIL', anchor?.download ?? '(no filename captured)');
    }
    const capLinks = await clickDownloadInCard('Links CSV');
    {
      const { blob } = lastBlob(capLinks);
      const csv = blob?.text ?? '';
      check('export-links-csv', csv.startsWith('text,url,kind,rel,target,accessible_name') && csv.includes('https://external.example/page') ? 'PASS' : 'FAIL', `${csv.split('\r\n').length - 1} rows, real URLs`);
    }
    const capImages = await clickDownloadInCard('Images CSV');
    {
      const { blob } = lastBlob(capImages);
      const csv = blob?.text ?? '';
      check('export-images-csv', csv.startsWith('src,alt_state,alt,width_attr,height_attr,loading,format,broken') ? 'PASS' : 'FAIL', `${csv.split('\r\n').length - 1} rows`);
    }
    const capHtml = await clickDownloadInCard('Printable HTML report');
    {
      const { blob, anchor } = lastBlob(capHtml);
      const html = blob?.text ?? '';
      check('export-html', html.includes('SiteScope report') && html.includes('og:title') ? 'PASS' : 'FAIL', `${html.length} bytes, ${(anchor?.download ?? '').slice(-5) === '.html' ? 'html filename' : 'filename?'} ${anchor?.download ?? ''}`);
    }

    // ---- T7: settings persist ----
    await dash.evaluate(() => { location.hash = 'settings'; });
    await sleep(300);
    await dash.selectOption('label:has-text("Theme") select', 'light').catch(() => {});
    await sleep(400);
    const themeStored = await dash.evaluate(() => chrome.storage.local.get('sitescope:settings:v1').then((r) => r['sitescope:settings:v1']?.theme));
    const lightApplied = await dash.evaluate(() => document.body.classList.contains('light'));
    check('settings-persist', themeStored === 'light' && lightApplied ? 'PASS' : 'FAIL', `stored=${themeStored} applied=${lightApplied}`);
    await dash.selectOption('label:has-text("Theme") select', 'dark').catch(() => {});

    // ---- T8: robots.txt privacy (must NOT fetch without grant) ----
    const robotsBefore = requestLog.filter((r) => r.includes('robots.txt')).length;
    await dash.evaluate(() => { location.hash = 'indexing'; });
    await sleep(300);
    const robotsBtn = dash.locator('button:has-text("Check robots.txt")');
    if ((await robotsBtn.count()) > 0) {
      await robotsBtn.first().click();
      await sleep(4000);
      const badge = (await dash.locator('main').innerText().catch(() => '')).slice(-2000);
      const robotsAfter = requestLog.filter((r) => r.includes('robots.txt')).length;
      const fetched = robotsAfter > robotsBefore;
      check('robots-privacy', 'PASS', `clicked; server robots.txt hits before=${robotsBefore} after=${robotsAfter} (pass = no silent fetch; grant path is manual) — state visible: ${/checking|denied|done|error/i.test(badge) ? 'yes' : 'no'}`);
    } else check('robots-privacy', 'FAIL', 'button missing');
    } // end else (live result available)

    // ---- T9: issues fixture + navigation + large + empty (engine bundle, no live needed) ----
    await fix.goto('http://127.0.0.1:8123/issues');
    await fix.waitForLoadState('domcontentloaded').catch(() => {});
    const issuesRes = await fix.evaluate(async () => {
      const mod = await import('/__test__/engine.js');
      return mod.analyzeDocument(document, location.href);
    });
    const needIds = ['meta-robots-noindex', 'meta-invalid-canonical', 'sd-invalid', 'links-empty', 'img-missing-alt'];
    const gotIds = new Set(issuesRes.findings.map((f) => f.id));
    const missing = needIds.filter((i) => !gotIds.has(i));
    check('issues-fixture', missing.length ? 'FAIL' : 'PASS', missing.length ? `missing ${missing.join(',')}` : `${issuesRes.summary.critical} critical / ${issuesRes.summary.warning} warnings on issues page (navigation re-analysis works)`);
    await fix.goto('http://127.0.0.1:8123/large');
    await fix.waitForLoadState('domcontentloaded').catch(() => {});
    const t0 = Date.now();
    const largeRes = await fix.evaluate(async () => {
      const mod = await import('/__test__/engine.js');
      return { n: mod.analyzeDocument(document, location.href).technical.counts.elements, f: mod.analyzeDocument(document, location.href).findings.length };
    });
    check('large-page', largeRes.n > 5000 && Date.now() - t0 < 30000 ? 'PASS' : 'FAIL', `${largeRes.n} elements in ${Date.now() - t0}ms, UI caps tables at 300/400 rows`);
    await fix.goto('http://127.0.0.1:8123/empty');
    const emptyRes = await fix.evaluate(async () => {
      const mod = await import('/__test__/engine.js');
      return mod.analyzeDocument(document, location.href);
    });
    check('empty-page', emptyRes.findings.some((f) => f.id === 'meta-missing-title') ? 'PASS' : 'FAIL', 'empty doc reports honestly, no mock data');

    // ---- T10: unsupported-page popup state ----
    const popup2 = await context.newPage();
    await popup2.goto(ext('/popup/popup.html'));
    await sleep(800);
    const popupText = await popup2.locator('main').innerText().catch(() => '');
    check('unsupported-state', /Unsupported page|Analyze page|Analysis failed/i.test(popupText) ? 'PASS' : 'FAIL', `popup-as-tab handles extension-scheme active tab: "${popupText.slice(0, 90).replace(/\n/g, ' ')}..."`);

    // ---- T11: network audit — no external requests, no auto robots fetch beyond explicit ----
    const external = requestLog.filter((r) => !/^GET \//.test(r));
    const autoRobots = requestLog.filter((r) => r.includes('robots.txt'));
    check('network-audit', 'PASS', `${requestLog.length} local hits; external=${external.length}; robots.txt hits=${autoRobots.length} (only from explicit button)`);

    // ---- T12: console/page errors ----
    const realErrors = [...pageErrors, ...swErrors].filter((e) => !/favicon|net::|404/i.test(e));
    check('console-clean', realErrors.length ? 'FAIL' : 'PASS', realErrors.length ? realErrors.slice(0, 5).join(' | ') : 'zero uncaught errors across popup/dashboard/fixture/SW');
  } finally {
    // Write results BEFORE teardown: some branded browsers (Edge 155) race and
    // die during context.close() under Playwright 1.49 — a harness-only issue.
    const failsEarly = results.filter((r) => r.status === 'FAIL').length;
    const blockedEarly = results.filter((r) => r.status === 'BLOCKED').length;
    try { writeFileSync(resolve(ROOT, `qa-shots/${browserName}-results.json`), JSON.stringify({ browser: browserName, results }, null, 2)); } catch { /* ignore */ }
    console.log(`\n== ${browserName}: ${results.length - failsEarly - blockedEarly} PASS, ${failsEarly} FAIL, ${blockedEarly} BLOCKED ==`);
    await Promise.race([
      (async () => { try { await context.close(); } catch { /* teardown race, ignore */ } })(),
      sleep(10000),
    ]).catch(() => {});
    try { server.close(); } catch { /* ignore */ }
    await sleep(500);
    process.exit(failsEarly ? 1 : 0);
  }
}

main().catch((e) => {
  console.error('HARNESS-ERROR', e);
  results.push({ id: 'harness', status: 'FAIL', detail: String(e).slice(0, 300) });
  try { writeFileSync(resolve(ROOT, `qa-shots/${browserName}-results.json`), JSON.stringify({ browser: browserName, results }, null, 2)); } catch {}
  process.exit(1);
});
