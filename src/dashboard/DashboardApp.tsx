import React from 'react';
import {
  ScanSearch, Download, Copy, Search, ShieldCheck, TriangleAlert,
  CircleCheck, Info, ExternalLink, Trash2, Printer, FileJson, FileSpreadsheet, Settings as SettingsIcon,
} from 'lucide-react';
import type { AnalysisResult, ExtensionSettings, Finding } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { extensionApi, getActiveTab, storageGet, storageSet, downloadBlob } from '../lib/browser/api';
import { checkPageSupport } from '../lib/browser/capabilities';
import { requestHostAccess, originPatternFor } from '../lib/browser/permissions';
import { requestAnalysisFromActiveTab, parseAnalysisResponse, sendRuntimeMessage } from '../lib/browser/messaging';
import { filterFindings } from '../lib/analyzers/engine';
import { analysisToJson, linksToCsv, imagesToCsv, findingsToCsv, reportToHtml, filenamesFor } from '../lib/export';
import { loadSettings, saveSettings, resetSettings, loadHistory, appendHistory, clearHistory } from '../lib/settings';
import { maskQuery, isSafeHref } from '../lib/utils/url';
import { Badge, Empty, Loading, Field, CopyButton, VersionTag } from '../components/ui';
import SupportPanel from './SupportPanel';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'seo', label: 'SEO' },
  { id: 'headings', label: 'Headings' },
  { id: 'social', label: 'Social' },
  { id: 'structured', label: 'Structured data' },
  { id: 'images', label: 'Images' },
  { id: 'links', label: 'Links' },
  { id: 'indexing', label: 'Indexing' },
  { id: 'technical', label: 'Technical' },
  { id: 'responsive', label: 'Responsive' },
  { id: 'export', label: 'Export' },
  { id: 'resources', label: 'Resources' },
  { id: 'support', label: 'Support' },
  { id: 'settings', label: 'Settings' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function tabFromHash(): TabId {
  const h = (location.hash || '').replace('#', '');
  return (TABS.some((t) => t.id === h) ? h : 'overview') as TabId;
}

export default function DashboardApp() {
  const [result, setResult] = React.useState<AnalysisResult | null>(null);
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [error, setError] = React.useState('');
  const [tab, setTab] = React.useState<TabId>(() => tabFromHash());
  const [settings, setSettings] = React.useState<ExtensionSettings>({ ...DEFAULT_SETTINGS });
  const [historyCount, setHistoryCount] = React.useState(0);

  React.useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  React.useEffect(() => {
    document.body.classList.toggle('light', settings.theme === 'light');
    if (settings.theme === 'system') {
      const dark = matchMedia('(prefers-color-scheme: dark)').matches;
      document.body.classList.toggle('light', !dark);
    }
  }, [settings.theme]);

  React.useEffect(() => {
    (async () => {
      try {
        const s = await loadSettings();
        setSettings(s);
        if (location.hash === '' || location.hash === '#') {
          const initial = (TABS.some((t) => t.id === s.defaultTab) ? s.defaultTab : 'overview') as TabId;
          setTab(initial);
        }
        const h = await loadHistory();
        setHistoryCount(h.length);
      } catch {
        /* defaults stand */
      }
      // Prefer cached result (saved by popup), else analyze live.
      try {
        const cached = await storageGet<AnalysisResult | null>('sitescope:last-result', null);
        if (cached?.pageUrl) {
          setResult(cached);
          setStatus('ready');
          return;
        }
      } catch {
        /* ignore */
      }
      await analyze(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function analyze(silent = false) {
    if (!silent) setStatus('loading');
    setError('');
    try {
      const api = extensionApi();
      if (!api?.tabs) {
        setStatus('empty');
        setError('Extension APIs are unavailable here. Open this page as the extension dashboard (via the toolbar popup) on a regular website.');
        return;
      }
      const t = await getActiveTab();
      // If dashboard itself is the active tab, there is no page to analyze — surface cached or empty.
      if (t?.url && (t.url.includes('dashboard.html') || t.url.includes('popup.html') || t.url.includes('sidepanel.html'))) {
        const cached = await storageGet<AnalysisResult | null>('sitescope:last-result', null);
        if (cached?.pageUrl) {
          setResult(cached);
          setStatus('ready');
          return;
        }
        setStatus('empty');
        return;
      }
      if (t?.url) {
        const sup = checkPageSupport(t.url);
        if (!sup.supported) {
          setStatus('error');
          setError(sup.reason ?? 'Unsupported page.');
          return;
        }
      }
      const r = await requestAnalysisFromActiveTab();
      setResult(r);
      setStatus('ready');
      try {
        await storageSet('sitescope:last-result', r);
        const s = await loadSettings();
        if (s.historyEnabled) {
          await appendHistory({ url: maskUrlForHistory(r.pageUrl), title: r.pageTitle, analyzedAt: r.analyzedAt, critical: r.summary.critical, warning: r.summary.warning }, s.historyLimit);
          setHistoryCount((await loadHistory()).length);
        }
      } catch {
        /* non-fatal */
      }
    } catch (e) {
      // Background-relay fallback: dashboard may itself message background
      try {
        const relayed = await analyzeViaBackground();
        if (relayed) {
          setResult(relayed);
          setStatus('ready');
          return;
        }
      } catch {
        /* fall through */
      }
      setStatus(result ? 'ready' : 'error');
      setError(e instanceof Error ? e.message : String(e));
      if (!result) setStatus('error');
    }
  }

  function switchTab(id: TabId) {
    setTab(id);
    location.hash = id;
  }

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 20, display: 'grid', gap: 14 }} aria-label="SiteScope full report">
      <Header result={result} onAnalyze={() => analyze(false)} analyzing={status === 'loading'} />
      <nav aria-label="Report sections" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className="ss-tab"
            onClick={() => switchTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {status === 'loading' ? <Loading label="Analyzing page…" /> : null}
      {status === 'error' ? (
        <div className="ss-surface" style={{ padding: 18 }} role="alert">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700 }}>
            <TriangleAlert size={16} aria-hidden="true" /> Could not analyze this page
          </div>
          <p>{error}</p>
          <p className="ss-muted">Internal browser pages, the web store, PDFs and restricted frames cannot be inspected. Open a regular website and retry.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="ss-accent-btn" onClick={() => analyze(false)}><ScanSearch size={14} aria-hidden="true" /> Retry analysis</button>
          </div>
        </div>
      ) : null}
      {status === 'empty' ? (
        <Empty title="No analysis yet" hint={error || 'Use the toolbar popup’s “Analyze page” on a regular website, then reopen this report.'} />
      ) : null}

      {status === 'ready' && result ? (
        <TabBody tab={tab} result={result} settings={settings} setSettings={setSettings} historyCount={historyCount} setHistoryCount={setHistoryCount} onAnalyze={() => analyze(false)} />
      ) : null}

      <footer className="ss-muted" style={{ fontSize: 12, display: 'flex', gap: 8, alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 12, flexWrap: 'wrap' }}>
        <ShieldCheck size={14} aria-hidden="true" />
        <span>SiteScope runs locally · No telemetry · <a href="#settings" style={{ color: 'inherit' }}>Privacy &amp; settings</a> · <VersionTag /></span>
        <span style={{ marginLeft: 'auto' }}>Made and designed by Abhinav Goyal and GoldenHour Delhi · © 2026 · <a href="#support" style={{ color: 'inherit' }}>Support</a></span>
      </footer>
    </main>
  );
}

function maskUrlForHistory(url: string): string {  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url.split('?')[0];
  }
}

async function analyzeViaBackground(): Promise<AnalysisResult | null> {
  const api = extensionApi();
  if (!api?.runtime?.sendMessage) return null;
  // Dual callback/promise handling (Firefox `browser.*` ignores callbacks).
  const resp = await sendRuntimeMessage(
    api as unknown as Parameters<typeof sendRuntimeMessage>[0],
    { type: 'SITESCOPE_ANALYZE_VIA_BACKGROUND' } as never,
  ).catch(() => null);
  return parseAnalysisResponse(resp);
}

function Header({ result, onAnalyze, analyzing }: { result: AnalysisResult | null; onAnalyze: () => void; analyzing: boolean }) {
  return (
    <header style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 10, background: '#c8f04a', color: '#1a2005', fontWeight: 800, fontSize: 19 }}>S</span>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: 18 }}>SiteScope report</h1>
        <div className="ss-muted ss-mono" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 560 }}>
          {result ? `${result.pageTitle} — ${result.pageUrl}` : 'Inspect. Understand. Improve.'}
        </div>
      </div>
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        {result ? (
          <span className="ss-muted" style={{ fontSize: 12, alignSelf: 'center' }} role="status">
            {result.summary.critical} critical · {result.summary.warning} warnings · {result.summary.passed} passed
          </span>
        ) : null}
        <button type="button" className="ss-accent-btn" onClick={onAnalyze} disabled={analyzing} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <ScanSearch size={14} aria-hidden="true" /> {analyzing ? 'Analyzing…' : 'Re-analyze'}
        </button>
      </span>
    </header>
  );
}

// ---------------- Tab bodies ----------------

function TabBody(props: { tab: TabId; result: AnalysisResult; settings: ExtensionSettings; setSettings: (s: ExtensionSettings) => void; historyCount: number; setHistoryCount: (n: number) => void; onAnalyze: () => void }) {
  const { tab, result } = props;
  switch (tab) {
    case 'overview': return <Overview result={result} />;
    case 'seo': return <SeoPanel result={result} />;
    case 'headings': return <HeadingsPanel result={result} />;
    case 'social': return <SocialPanel result={result} />;
    case 'structured': return <StructuredPanel result={result} />;
    case 'images': return <ImagesPanel result={result} settings={props.settings} />;
    case 'links': return <LinksPanel result={result} />;
    case 'indexing': return <IndexingPanel result={result} />;
    case 'technical': return <TechnicalPanel result={result} />;
    case 'responsive': return <ResponsivePanel result={result} />;
    case 'export': return <ExportPanel result={result} settings={props.settings} />;
    case 'resources': return <ResourcesPanel />;
    case 'support': return <SupportPanel />;
    case 'settings': return <SettingsPanel settings={props.settings} setSettings={props.setSettings} historyCount={props.historyCount} setHistoryCount={props.setHistoryCount} />;
    default: return <Overview result={result} />;
  }
}

function FindingsList({ findings, title }: { findings: Finding[]; title: string }) {
  const [sev, setSev] = React.useState('all');
  const [q, setQ] = React.useState('');
  const filtered = filterFindings(findings, sev, q);
  return (
    <section aria-label={title} style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label className="sr-only" htmlFor="sev-filter">Filter by severity</label>
        <select id="sev-filter" className="ss-select" value={sev} onChange={(e) => setSev(e.target.value)}>
          <option value="all">All severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
          <option value="passed">Passed</option>
        </select>
        <span style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={14} aria-hidden="true" style={{ position: 'absolute', left: 8, top: 9, color: 'var(--muted)' }} />
          <input className="ss-input" style={{ width: '100%', paddingLeft: 28 }} placeholder="Search findings…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search findings" />
        </span>
        <button type="button" className="ss-ghost-btn" onClick={() => { try { navigator.clipboard.writeText(filtered.map((f) => `[${f.severity}] ${f.title} — ${f.recommendation}`).join('\n')); } catch { /* ignore */ } }} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Copy size={14} aria-hidden="true" /> Copy filtered ({filtered.length})
        </button>
      </div>
      {filtered.length === 0 ? <Empty title="No findings match" hint="Adjust the severity filter or search query." /> : null}
      {filtered.map((f) => (
        <article key={f.id} className="ss-surface" style={{ padding: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge severity={f.severity} />
            <strong>{f.title}</strong>
            <span className="ss-muted" style={{ fontSize: 11 }}>{f.category} · {f.id}</span>
          </div>
          <p style={{ margin: '6px 0' }}>{f.explanation}</p>
          {f.evidence ? <pre className="ss-mono ss-muted" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'var(--surface-2)', padding: 8, borderRadius: 8 }}>{f.evidence}</pre> : null}
          <p style={{ margin: '6px 0' }}><em>Recommendation:</em> {f.recommendation}</p>
          {f.limitation ? <p className="ss-muted" style={{ margin: 0, fontSize: 12 }}><em>Limitation:</em> {f.limitation}</p> : null}
        </article>
      ))}
    </section>
  );
}

function Overview({ result }: { result: AnalysisResult }) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }} role="status" aria-label="Summary counts">
        <CountCard n={result.summary.critical} label="Critical" sev="critical" icon={<TriangleAlert size={14} aria-hidden="true" />} />
        <CountCard n={result.summary.warning} label="Warnings" sev="warning" icon={<TriangleAlert size={14} aria-hidden="true" />} />
        <CountCard n={result.summary.info} label="Info" sev="info" icon={<Info size={14} aria-hidden="true" />} />
        <CountCard n={result.summary.passed} label="Passed" sev="passed" icon={<CircleCheck size={14} aria-hidden="true" />} />
      </div>
      <div className="ss-surface" style={{ padding: 12 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 14 }}>Page</h2>
        <dl style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '4px 12px', margin: 0, fontSize: 12.5 }}>
          <dt className="ss-muted">Title</dt><dd style={{ margin: 0 }}>{result.pageTitle}</dd>
          <dt className="ss-muted">URL</dt><dd style={{ margin: 0 }} className="ss-mono">{result.pageUrl}</dd>
          <dt className="ss-muted">Analyzed</dt><dd style={{ margin: 0 }}>{result.analyzedAt}</dd>
          <dt className="ss-muted">Heads-up</dt><dd style={{ margin: 0 }}>Header status, robots.txt and HTTP reachability are <em>not</em> verified from the DOM — see the Indexing tab.</dd>
        </dl>
      </div>
      <FindingsList findings={result.findings} title="All findings" />
    </div>
  );
}

function CountCard({ n, label, sev, icon }: { n: number; label: string; sev: string; icon: React.ReactNode }) {
  return (
    <div className="ss-surface" style={{ padding: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
      <span aria-hidden="true">{icon}</span>
      <span><strong style={{ fontSize: 18 }}>{n}</strong><br /><Badge severity={sev as Finding['severity']}>{label}</Badge></span>
    </div>
  );
}

function SeoPanel({ result }: { result: AnalysisResult }) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="ss-surface" style={{ overflowX: 'auto' }}>
        <table className="ss-table">
          <thead><tr><th>Field</th><th>Value</th><th>Status</th><th>Note</th><th /></tr></thead>
          <tbody>
            {result.meta.map((m) => (
              <tr key={m.key}>
                <td className="ss-mono">{m.key}</td>
                <td style={{ maxWidth: 320, overflowWrap: 'anywhere' }}>{m.rawValue || <span className="ss-muted">(empty)</span>}</td>
                <td><Badge severity={m.status}>{m.status}</Badge></td>
                <td className="ss-muted">{m.note}</td>
                <td><CopyButton value={m.rawValue} label={m.key} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <FindingsList findings={result.findings.filter((f) => f.category === 'metadata' || f.category === 'general')} title="SEO findings" />
    </div>
  );
}

function HeadingsPanel({ result }: { result: AnalysisResult }) {
  const [level, setLevel] = React.useState('all');
  const [q, setQ] = React.useState('');
  const filtered = result.headings.filter((h) => (level === 'all' || `h${h.level}` === level) && (!q || h.text.toLowerCase().includes(q.toLowerCase())));
  async function highlight() {
    try {
      const api = extensionApi();
      const tabs = await api?.tabs?.query({ active: true, currentWindow: true });
      const id = tabs?.[0]?.id;
      if (id && api?.tabs?.sendMessage) {
        await api.tabs.sendMessage(id, { type: 'SITESCOPE_HIGHLIGHT_HEADINGS' });
      }
    } catch {
      /* highlight is best-effort */
    }
  }
  function exportJson() {
    downloadBlob(new Blob([JSON.stringify(result.headings, null, 2)], { type: 'application/json' }), filenamesFor(hostOf(result)).json.replace('.json', '.headings.json'));
  }
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="ss-surface" style={{ padding: 10 }} role="status">
        {(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const).map((h) => (
          <span key={h} className="ss-mono ss-muted" style={{ marginRight: 12 }}>{h}: {result.headingCounts[h] ?? 0}</span>
        ))}
        <span className="ss-muted"> · total {result.headings.length}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select className="ss-select" value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Filter by heading level">
          <option value="all">All levels</option>
          <option value="h1">H1</option><option value="h2">H2</option><option value="h3">H3</option>
          <option value="h4">H4</option><option value="h5">H5</option><option value="h6">H6</option>
        </select>
        <input className="ss-input" placeholder="Filter heading text…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter heading text" style={{ flex: 1, minWidth: 160 }} />
        <button type="button" className="ss-ghost-btn" onClick={highlight}>Highlight on page</button>
        <button type="button" className="ss-ghost-btn" onClick={exportJson}>Export JSON</button>
      </div>
      <div className="ss-surface" style={{ overflowX: 'auto' }}>
        <table className="ss-table">
          <thead><tr><th>#</th><th>Level</th><th>Text</th><th>State</th></tr></thead>
          <tbody>
            {filtered.map((h) => (
              <tr key={h.order}>
                <td className="ss-mono">{h.order}</td>
                <td><span className="ss-badge">H{h.level}</span></td>
                <td style={{ paddingLeft: (h.level - 1) * 14 }}>{h.text || <em className="ss-muted">(empty)</em>}</td>
                <td>{h.empty ? <Badge severity="warning">empty</Badge> : <Badge severity="passed">ok</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? <div style={{ padding: 12 }}><Empty title="No headings match" /></div> : null}
      </div>
      <FindingsList findings={result.findings.filter((f) => f.category === 'headings')} title="Heading findings" />
    </div>
  );
}

function SocialPanel({ result }: { result: AnalysisResult }) {
  const ogEntries = Object.entries(result.social.og);
  const twEntries = Object.entries(result.social.twitter);
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="ss-surface" style={{ padding: 12 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 14 }}>Share preview (approximate — networks render their own cards)</h2>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ width: 120, height: 90, borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }} aria-hidden="true">
            {result.social.og['og:image'] ? <span className="ss-mono" style={{ fontSize: 10, padding: 6, overflowWrap: 'anywhere' }}>{result.social.og['og:image'].slice(0, 80)}</span> : <span className="ss-muted">no image</span>}
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>{result.social.og['og:title'] || result.pageTitle}</div>
            <div className="ss-muted" style={{ fontSize: 12 }}>{result.social.og['og:description'] || '(no og:description)'}</div>
            <div className="ss-mono ss-muted" style={{ fontSize: 11 }}>{result.social.og['og:url'] || result.pageUrl}</div>
          </div>
        </div>
      </div>
      <MetaTable title="Open Graph (og:*)" entries={ogEntries} emptyHint="No og:* tags found." />
      <MetaTable title="Twitter / X (twitter:*)" entries={twEntries} emptyHint="No twitter:* tags found." />
      <FindingsList findings={result.findings.filter((f) => f.category === 'social')} title="Social findings" />
    </div>
  );
}

function MetaTable({ title, entries, emptyHint }: { title: string; entries: Array<[string, string]>; emptyHint: string }) {
  return (
    <div className="ss-surface" style={{ padding: 12 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>{title}</h3>
      {entries.length === 0 ? <div className="ss-muted">{emptyHint}</div> : (
        <table className="ss-table">
          <thead><tr><th>Property</th><th>Value</th><th /></tr></thead>
          <tbody>
            {entries.map(([k, v]) => (
              <tr key={k}>
                <td className="ss-mono">{k}</td>
                <td style={{ overflowWrap: 'anywhere' }}>{v || <span className="ss-muted">(empty)</span>}</td>
                <td><CopyButton value={v} label={k} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function StructuredPanel({ result }: { result: AnalysisResult }) {
  const [raw, setRaw] = React.useState(false);
  if (result.jsonLd.length === 0) return <div style={{ display: 'grid', gap: 10 }}><Empty title="No JSON-LD found" hint="Structured data is optional. Microdata/RDFa were not evaluated." /><FindingsList findings={result.findings.filter((f) => f.category === 'structured-data')} title="Structured data findings" /></div>;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="ss-ghost-btn" onClick={() => setRaw(!raw)} aria-pressed={raw}>{raw ? 'Tree view' : 'Raw JSON view'}</button>
        <button type="button" className="ss-ghost-btn" onClick={() => downloadBlob(new Blob([JSON.stringify(result.jsonLd.map((b) => b.parsed ?? b.raw), null, 2)], { type: 'application/json' }), filenamesFor(hostOf(result)).json.replace('.json', '.jsonld.json'))}>Download JSON-LD</button>
      </div>
      {result.jsonLd.map((b) => (
        <div key={b.index} className="ss-surface" style={{ padding: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <strong>Block #{b.index + 1}</strong>
            {b.parseError ? <Badge severity="critical">invalid JSON</Badge> : b.empty ? <Badge severity="warning">empty</Badge> : <Badge severity="passed">valid JSON</Badge>}
            {b.types.map((t) => <span key={t} className="ss-badge">{t}</span>)}
            <span style={{ marginLeft: 'auto' }}><CopyButton value={b.raw} label={`JSON-LD block ${b.index + 1}`} /></span>
          </div>
          {b.parseError ? <p role="alert">Parse error: {b.parseError}</p> : null}
          <pre className="ss-mono" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'var(--surface-2)', padding: 10, borderRadius: 8, maxHeight: raw ? 420 : 220, overflow: 'auto' }}>
            {raw ? b.raw : JSON.stringify(b.parsed ?? b.raw, null, 2)}
          </pre>
          <p className="ss-muted" style={{ fontSize: 12 }}>Page content is untrusted and never executed. Type names are checked locally only — confirm rich-result eligibility in Google’s Rich Results Test.</p>
        </div>
      ))}
      <FindingsList findings={result.findings.filter((f) => f.category === 'structured-data')} title="Structured data findings" />
    </div>
  );
}

function ImagesPanel({ result, settings }: { result: AnalysisResult; settings: ExtensionSettings }) {
  const [filter, setFilter] = React.useState('all');
  const [q, setQ] = React.useState('');
  const filtered = result.images.filter((i) => {
    if (filter === 'missing-alt' && i.altState !== 'missing') return false;
    if (filter === 'empty-alt' && i.altState !== 'empty-decorative') return false;
    if (filter === 'no-dims' && (i.widthAttr && i.heightAttr)) return false;
    if (filter === 'lazy' && !i.lazy) return false;
    if (filter === 'broken' && !i.broken) return false;
    if (filter === 'large' && !((i.displayedWidth ?? 0) >= settings.largeImageMinWidth || (i.naturalWidth ?? 0) >= settings.largeImageMinWidth)) return false;
    if (q && !`${i.resolvedUrl} ${i.alt ?? ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select className="ss-select" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter images">
          <option value="all">All ({result.images.length})</option>
          <option value="missing-alt">Missing alt</option>
          <option value="empty-alt">Empty alt (decorative)</option>
          <option value="no-dims">Missing dimensions</option>
          <option value="lazy">Lazy-loaded</option>
          <option value="broken">Broken / unloaded</option>
          <option value="large">Large rendered</option>
        </select>
        <input className="ss-input" placeholder="Search src or alt…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search images" style={{ flex: 1, minWidth: 160 }} />
        <button type="button" className="ss-ghost-btn" onClick={() => downloadBlob(new Blob([imagesToCsv({ ...result, images: filtered })], { type: 'text/csv' }), filenamesFor(hostOf(result)).imagesCsv)} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <FileSpreadsheet size={14} aria-hidden="true" /> Export CSV ({filtered.length})
        </button>
      </div>
      <div className="ss-surface" style={{ overflowX: 'auto' }}>
        <table className="ss-table">
          <thead><tr><th>Image</th><th>Alt</th><th>Dims</th><th>Loading</th><th>Format</th><th>State</th></tr></thead>
          <tbody>
            {filtered.slice(0, 300).map((i, n) => (
              <tr key={n}>
                <td className="ss-mono" style={{ maxWidth: 260, overflowWrap: 'anywhere' }} title={i.resolvedUrl}>{i.resolvedUrl.slice(0, 90)}{i.resolvedUrl.length > 90 ? '…' : ''}</td>
                <td>{i.altState === 'missing' ? <Badge severity="warning">missing</Badge> : i.altState === 'empty-decorative' ? <Badge severity="info">empty (decorative)</Badge> : <span>{i.alt}</span>}</td>
                <td className="ss-mono">{i.widthAttr && i.heightAttr ? `${i.widthAttr}×${i.heightAttr}` : <span className="ss-muted">—</span>}{i.naturalWidth ? ` (${i.naturalWidth}×${i.naturalHeight})` : ''}</td>
                <td>{i.loading ?? <span className="ss-muted">—</span>}{i.lazy ? ' (lazy)' : ''}</td>
                <td>{i.format ?? <span className="ss-muted">?</span>}</td>
                <td>{i.broken ? <Badge severity="warning">broken?</Badge> : <Badge severity="passed">ok</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 300 ? <div className="ss-muted" style={{ padding: 10 }}>Showing first 300 of {filtered.length} — refine filters or export CSV for the full list.</div> : null}
        {filtered.length === 0 ? <div style={{ padding: 12 }}><Empty title="No images match" /></div> : null}
      </div>
      <p className="ss-muted" style={{ fontSize: 12 }}>File size and cache behavior cannot be inferred from the DOM. Images are never bulk-downloaded or sent anywhere.</p>
      <FindingsList findings={result.findings.filter((f) => f.category === 'images')} title="Image findings" />
    </div>
  );
}

function LinksPanel({ result }: { result: AnalysisResult }) {
  const [kind, setKind] = React.useState('all');
  const [rel, setRel] = React.useState('all');
  const [q, setQ] = React.useState('');
  const [sort, setSort] = React.useState<'url' | 'text' | 'kind'>('url');
  const filtered = result.links
    .filter((l) => (kind === 'all' || l.kind === kind || (kind === 'internal-external' && (l.kind === 'internal' || l.kind === 'external'))))
    .filter((l) => (rel === 'all' || l.relTokens.includes(rel)))
    .filter((l) => (!q || `${l.text} ${l.resolvedUrl ?? ''} ${l.href ?? ''}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => sort === 'text' ? a.text.localeCompare(b.text) : sort === 'kind' ? a.kind.localeCompare(b.kind) : (a.resolvedUrl ?? a.href ?? '').localeCompare(b.resolvedUrl ?? b.href ?? ''));
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select className="ss-select" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Filter by link type">
          <option value="all">All types ({result.links.length})</option>
          <option value="internal">Internal</option>
          <option value="external">External</option>
          <option value="same-page">Same-page</option>
          <option value="email">Email</option>
          <option value="telephone">Telephone</option>
          <option value="other-protocol">Other protocol</option>
          <option value="empty">Empty</option>
        </select>
        <select className="ss-select" value={rel} onChange={(e) => setRel(e.target.value)} aria-label="Filter by rel">
          <option value="all">Any rel</option>
          <option value="nofollow">nofollow</option>
          <option value="sponsored">sponsored</option>
          <option value="ugc">ugc</option>
          <option value="noopener">noopener</option>
          <option value="noreferrer">noreferrer</option>
        </select>
        <select className="ss-select" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort links">
          <option value="url">Sort: URL</option>
          <option value="text">Sort: text</option>
          <option value="kind">Sort: kind</option>
        </select>
        <input className="ss-input" placeholder="Search text or URL…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search links" style={{ flex: 1, minWidth: 160 }} />
        <button type="button" className="ss-ghost-btn" onClick={() => downloadBlob(new Blob([linksToCsv({ ...result, links: filtered })], { type: 'text/csv' }), filenamesFor(hostOf(result)).linksCsv)} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <FileSpreadsheet size={14} aria-hidden="true" /> Export CSV ({filtered.length})
        </button>
      </div>
      <div className="ss-surface" style={{ overflowX: 'auto' }}>
        <table className="ss-table">
          <thead><tr><th>Text</th><th>URL</th><th>Kind</th><th>rel / target</th><th>Copy</th></tr></thead>
          <tbody>
            {filtered.slice(0, 400).map((l, n) => (
              <tr key={n}>
                <td style={{ maxWidth: 200 }}>{l.accessibleName || <em className="ss-muted">(no accessible name)</em>}{l.emptyText ? ' ' : ''}{l.hasImage ? <span className="ss-muted"> [img]</span> : null}</td>
                <td className="ss-mono" style={{ maxWidth: 280, overflowWrap: 'anywhere' }}>
                  {l.resolvedUrl && isSafeHref(l.href) ? <a href={l.resolvedUrl} target="_blank" rel="noreferrer noopener" style={{ color: 'inherit' }}>{(l.resolvedUrl ?? '').slice(0, 80)}</a> : (l.href ?? <em className="ss-muted">(empty)</em>)}
                  {l.malformed ? <div><Badge severity="warning">malformed</Badge></div> : null}
                </td>
                <td><span className="ss-badge">{l.kind}</span></td>
                <td className="ss-mono" style={{ fontSize: 11 }}>{l.rel ?? '—'}{l.target ? ` · ${l.target}` : ''}</td>
                <td>{l.resolvedUrl ? <CopyButton value={l.resolvedUrl} label="URL" /> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 400 ? <div className="ss-muted" style={{ padding: 10 }}>Showing first 400 of {filtered.length} — refine filters or export CSV.</div> : null}
        {filtered.length === 0 ? <div style={{ padding: 12 }}><Empty title="No links match" /></div> : null}
      </div>
      <div className="ss-surface" style={{ padding: 12 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 13 }}>About rel attributes</h3>
        <p className="ss-muted" style={{ margin: 0, fontSize: 12 }}>nofollow asks crawlers not to pass endorsement; sponsored marks paid links; ugc marks user-generated content; noopener/noreferrer protect _blank targets. No link is labeled “broken” without fetching — use manual spot-checks for critical targets.</p>
      </div>
      <FindingsList findings={result.findings.filter((f) => f.category === 'links')} title="Link findings" />
    </div>
  );
}

function IndexingPanel({ result }: { result: AnalysisResult }) {
  const idx = result.findings.filter((f) => f.category === 'indexing');
  const [robotsState, setRobotsState] = React.useState<'idle' | 'checking' | 'done' | 'denied' | 'error'>('idle');
  const [robotsText, setRobotsText] = React.useState('');
  async function checkRobots() {
    setRobotsState('checking');
    setRobotsText('');
    try {
      const pat = originPatternFor(result.pageUrl);
      if (!pat) {
        setRobotsState('error');
        setRobotsText('Cannot determine a host pattern for this URL.');
        return;
      }
      const granted = await requestHostAccess(pat);
      if (!granted) {
        setRobotsState('denied');
        setRobotsText('Permission was not granted. robots.txt was not fetched — nothing was sent anywhere.');
        return;
      }
      const origin = new URL(result.pageUrl).origin;
      const res = await fetch(`${origin}/robots.txt`, { redirect: 'follow' });
      if (!res.ok) {
        setRobotsState('done');
        setRobotsText(`robots.txt responded with HTTP ${res.status} (treated as “not found” for crawl purposes).`);
        return;
      }
      const text = (await res.text()).slice(0, 8000);
      setRobotsText(text || '(empty robots.txt)');
      setRobotsState('done');
    } catch (e) {
      setRobotsState('error');
      setRobotsText(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="ss-surface" style={{ padding: 12 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 14 }}>Crawl &amp; index signals (DOM-visible only)</h2>
        <table className="ss-table">
          <thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead>
          <tbody>
            <Row check="Meta robots" status={result.meta.find((m) => m.key === 'meta:robots')?.rawValue ? 'found' : 'not-found'} detail={result.meta.find((m) => m.key === 'meta:robots')?.normalized ?? ''} />
            <Row check="Canonical" status={result.meta.find((m) => m.key === 'link:canonical')?.rawValue ? 'found' : 'not-found'} detail={result.meta.find((m) => m.key === 'link:canonical')?.normalized ?? ''} />
            <Row check="X-Robots-Tag" status="could-not-verify" detail="Response headers are invisible to DOM inspection." />
            <Row check="HTTP status / redirects" status="could-not-verify" detail="Use DevTools Network for the true status code." />
            <Row check="robots.txt / sitemaps" status="could-not-verify" detail="Requires your explicit action + narrow host permission (below)." />
          </tbody>
        </table>
      </div>
      <div className="ss-surface" style={{ padding: 12 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 13 }}>Optional: check robots.txt</h3>
        <p className="ss-muted" style={{ fontSize: 12 }}>Requests access to <span className="ss-mono">{(() => { try { return new URL(result.pageUrl).origin + '/*'; } catch { return '(origin)'; } })()}</span> only, fetches <span className="ss-mono">/robots.txt</span> once, and shows it here. Nothing is uploaded.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="ss-ghost-btn" onClick={checkRobots} disabled={robotsState === 'checking'}>{robotsState === 'checking' ? 'Checking…' : 'Check robots.txt'}</button>
        </div>
        {robotsState !== 'idle' ? (
          <div role="status" style={{ marginTop: 8 }}>
            <div><Badge severity={robotsState === 'done' ? 'info' : robotsState === 'denied' ? 'warning' : robotsState === 'error' ? 'critical' : 'info'}>{robotsState}</Badge></div>
            <pre className="ss-mono" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'var(--surface-2)', padding: 10, borderRadius: 8, maxHeight: 260, overflow: 'auto' }}>{robotsText || '(no output yet)'}</pre>
          </div>
        ) : null}
      </div>
      <FindingsList findings={idx} title="Indexing findings" />
    </div>
  );
}

function Row({ check, status, detail }: { check: string; status: string; detail: string }) {
  const sev = status === 'found' ? 'info' : status === 'not-found' ? 'warning' : 'info';
  return (
    <tr>
      <td>{check}</td>
      <td><Badge severity={sev as Finding['severity']}>{status}</Badge></td>
      <td className="ss-muted">{detail}</td>
    </tr>
  );
}

function TechnicalPanel({ result }: { result: AnalysisResult }) {
  const t = result.technical;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="ss-surface" style={{ padding: 12 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 14 }}>Page &amp; document</h2>
        <dl style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: '4px 12px', margin: 0, fontSize: 12.5 }}>
          <dt className="ss-muted">URL</dt><dd className="ss-mono" style={{ margin: 0, overflowWrap: 'anywhere' }}>{t.url}</dd>
          <dt className="ss-muted">Origin / protocol</dt><dd style={{ margin: 0 }}>{t.origin} · {t.protocol} {t.https ? '✓ HTTPS' : '⚠ not HTTPS'}</dd>
          <dt className="ss-muted">Host / path</dt><dd className="ss-mono" style={{ margin: 0 }}>{t.hostname}{t.path}</dd>
          <dt className="ss-muted">Query (masked)</dt><dd className="ss-mono" style={{ margin: 0 }}>{maskQuery(result.pageUrl) || '(none)'} <span className="ss-muted">— sensitive keys hidden</span></dd>
          <dt className="ss-muted">Language / charset</dt><dd style={{ margin: 0 }}>{t.language || '(no lang)'} · {t.charset || '(no charset)'}</dd>
          <dt className="ss-muted">Viewport</dt><dd style={{ margin: 0 }}>{t.viewport || '(none)'}</dd>
          <dt className="ss-muted">DOM</dt><dd style={{ margin: 0 }}>{t.counts.elements.toLocaleString()} elements · depth {t.counts.domDepth} · {t.counts.scripts} scripts · {t.counts.stylesheets} stylesheets</dd>
          <dt className="ss-muted">Timing</dt><dd style={{ margin: 0 }} className="ss-mono">DCL {t.timing.domContentLoaded ?? 'n/a'}ms · load {t.timing.load ?? 'n/a'}ms · first-paint {t.timing.firstPaint ?? 'n/a'}ms</dd>
        </dl>
      </div>
      <div className="ss-surface" style={{ padding: 12 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 13 }}>Favicons &amp; manifest link</h3>
        {result.favicons.length === 0 ? <div className="ss-muted">No icon links declared.</div> : (
          <table className="ss-table">
            <thead><tr><th>rel</th><th>href</th><th>sizes</th><th>type</th></tr></thead>
            <tbody>
              {result.favicons.map((f, i) => (
                <tr key={i}><td className="ss-mono">{f.rel}</td><td className="ss-mono" style={{ overflowWrap: 'anywhere' }}>{f.resolvedUrl}</td><td>{f.sizes ?? '—'}</td><td>{f.type ?? '—'}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="ss-muted" style={{ fontSize: 12 }}>Manifest: {result.manifest.resolvedUrl ?? '(none)'} — {result.manifest.note}</p>
      </div>
      <FindingsList findings={result.findings.filter((f) => f.category === 'technical' || f.category === 'favicon')} title="Technical findings" />
    </div>
  );
}

const PRESETS = [
  { name: 'Mobile 360', w: 360, h: 800 },
  { name: 'Mobile 390', w: 390, h: 844 },
  { name: 'Tablet 768', w: 768, h: 1024 },
  { name: 'Laptop 1280', w: 1280, h: 800 },
  { name: 'Desktop 1440', w: 1440, h: 900 },
  { name: 'Wide 1920', w: 1920, h: 1080 },
];

function ResponsivePanel({ result }: { result: AnalysisResult }) {
  const [w, setW] = React.useState(390);
  const [h, setH] = React.useState(844);
  async function openSized(width: number, height: number) {
    const url = result.pageUrl;
    try {
      const api = extensionApi();
      const wins = (api as unknown as { windows?: { create: (o: unknown) => Promise<unknown> } })?.windows;
      if (wins?.create) {
        await wins.create({ url, width: Math.max(200, Math.min(2560, width)), height: Math.max(200, Math.min(1600, height)), focused: true });
        return;
      }
    } catch {
      /* fall through */
    }
    globalThis.open?.(url, '_blank', `width=${width},height=${height}`);
  }
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="ss-surface" style={{ padding: 12 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 14 }}>Responsive helper</h2>
        <p className="ss-muted" style={{ fontSize: 12 }}>Opens the <em>current URL</em> in a new window at the chosen size so you can check layout, overflow and viewport behavior. This is a real window resize — not a simulated device, not a popup zoom trick.</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
          {PRESETS.map((p) => (
            <button key={p.name} type="button" className="ss-ghost-btn" onClick={() => { setW(p.w); setH(p.h); void openSized(p.w, p.h); }}>{p.name}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
          <Field label="Width (px)"><input className="ss-input" type="number" min={200} max={2560} value={w} onChange={(e) => setW(Number(e.target.value))} /></Field>
          <Field label="Height (px)"><input className="ss-input" type="number" min={200} max={1600} value={h} onChange={(e) => setH(Number(e.target.value))} /></Field>
          <button type="button" className="ss-accent-btn" onClick={() => openSized(w, h)}><ExternalLink size={14} aria-hidden="true" /> Open {w}×{h}</button>
        </div>
      </div>
      <div className="ss-surface" style={{ padding: 12 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 13 }}>What to check at each width</h3>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }} className="ss-muted">
          <li>Horizontal scrollbar / overflowing elements (DevTools: check scrollWidth &gt; clientWidth).</li>
          <li>Viewport meta present: {result.technical.viewport ? 'yes' : 'missing — mobile layout will break'}.</li>
          <li>Images scaling (max-width: 100%) and tap targets ≥ 24px.</li>
          <li>Compare 360 → 768 → 1280 for nav, tables and headings reflow.</li>
        </ul>
      </div>
    </div>
  );
}

function ExportPanel({ result, settings }: { result: AnalysisResult; settings: ExtensionSettings }) {
  const host = hostOf(result);
  const names = filenamesFor(host);
  const hasQuery = (() => { try { return new URL(result.pageUrl).search.length > 0; } catch { return false; } })();
  function dl(kind: 'json' | 'links' | 'images' | 'findings' | 'html') {
    if (hasQuery && !settings.exportIncludeQuery) {
      const ok = confirm('This URL contains query parameters. Exports always use masked values, but filenames omit queries. Continue?');
      if (!ok) return;
    }
    if (kind === 'json') downloadBlob(new Blob([analysisToJson(result)], { type: 'application/json' }), names.json);
    if (kind === 'links') downloadBlob(new Blob([linksToCsv(result)], { type: 'text/csv' }), names.linksCsv);
    if (kind === 'images') downloadBlob(new Blob([imagesToCsv(result)], { type: 'text/csv' }), names.imagesCsv);
    if (kind === 'findings') downloadBlob(new Blob([findingsToCsv(result)], { type: 'text/csv' }), names.findingsCsv);
    if (kind === 'html') downloadBlob(new Blob([reportToHtml(result)], { type: 'text/html' }), names.html);
  }
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {hasQuery ? <div className="ss-surface" style={{ padding: 10 }} role="note"><TriangleAlert size={14} aria-hidden="true" /> URL has query parameters — values are masked in the UI and report; filenames never include raw queries.</div> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
        <ExportCard icon={<FileJson size={16} aria-hidden="true" />} title="Full analysis (JSON)" desc={`All sections + findings. ${names.json}`} onClick={() => dl('json')} />
        <ExportCard icon={<FileSpreadsheet size={16} aria-hidden="true" />} title={`Links CSV (${result.links.length})`} desc={names.linksCsv} onClick={() => dl('links')} />
        <ExportCard icon={<FileSpreadsheet size={16} aria-hidden="true" />} title={`Images CSV (${result.images.length})`} desc={names.imagesCsv} onClick={() => dl('images')} />
        <ExportCard icon={<FileSpreadsheet size={16} aria-hidden="true" />} title={`Findings CSV (${result.findings.length})`} desc={names.findingsCsv} onClick={() => dl('findings')} />
        <ExportCard icon={<Printer size={16} aria-hidden="true" />} title="Printable HTML report" desc={`${names.html} — then Print → Save as PDF`} onClick={() => dl('html')} />
      </div>
      <div className="ss-surface" style={{ padding: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="ss-ghost-btn" onClick={() => globalThis.print()} style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Printer size={14} aria-hidden="true" /> Print this report</button>
        <CopyButton value={result.pageUrl} label="page URL" />
        <span className="ss-muted" style={{ fontSize: 12, alignSelf: 'center' }}>Exports are generated locally from real results. Large reports are chunked in the tables above; CSVs contain the full filtered set.</span>
      </div>
    </div>
  );
}

function ExportCard({ icon, title, desc, onClick }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <div className="ss-surface" style={{ padding: 12, display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700 }}>{icon}{title}</div>
      <div className="ss-mono ss-muted" style={{ fontSize: 11, overflowWrap: 'anywhere' }}>{desc}</div>
      <button type="button" className="ss-accent-btn" onClick={onClick} style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}><Download size={14} aria-hidden="true" /> Download</button>
    </div>
  );
}

const RESOURCES: Array<{ name: string; url: string; desc: string }> = [
  { name: 'Google Search Console', url: 'https://search.google.com/search-console', desc: 'Index coverage, enhancements, manual actions.' },
  { name: 'Rich Results Test', url: 'https://search.google.com/test/rich-results', desc: 'Paste a URL to check rich-result eligibility (SiteScope only pre-checks locally).' },
  { name: 'PageSpeed Insights', url: 'https://pagespeed.web.dev/', desc: 'Lab + field performance (LCP/INP/CLS) — SiteScope never invents these.' },
  { name: 'Schema.org docs', url: 'https://schema.org/docs/documents.html', desc: 'Vocabulary reference for structured data types.' },
  { name: 'Lighthouse docs', url: 'https://developer.chrome.com/docs/lighthouse/', desc: 'How performance/SEO audits are scored.' },
  { name: 'Google Search Central', url: 'https://developers.google.com/search/docs', desc: 'Crawling, indexing and ranking documentation.' },
];

function ResourcesPanel() {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="ss-surface" style={{ padding: 12 }} role="note">
        <strong>Privacy note:</strong> <span className="ss-muted">Nothing is sent until you click. Opening a tool may transmit the URL you paste there — check each site’s policy.</span>
      </div>
      {RESOURCES.map((r) => (
        <div key={r.url} className="ss-surface" style={{ padding: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>{r.name}</div>
            <div className="ss-muted" style={{ fontSize: 12 }}>{r.desc}</div>
            <div className="ss-mono ss-muted" style={{ fontSize: 11 }}>{r.url}</div>
          </div>
          <a className="ss-ghost-btn" style={{ textDecoration: 'none' }} href={r.url} target="_blank" rel="noreferrer noopener">Open <ExternalLink size={12} aria-hidden="true" /></a>
        </div>
      ))}
    </div>
  );
}

function SettingsPanel(props: { settings: ExtensionSettings; setSettings: (s: ExtensionSettings) => void; historyCount: number; setHistoryCount: (n: number) => void }) {
  const { settings, setSettings } = props;
  const [saved, setSaved] = React.useState(false);
  async function update(patch: Partial<ExtensionSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    await saveSettings(next);
    setSaved(true);
    globalThis.setTimeout(() => setSaved(false), 1200);
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="ss-surface" style={{ padding: 12, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 14, display: 'flex', gap: 6, alignItems: 'center' }}><SettingsIcon size={15} aria-hidden="true" /> Preferences (stored locally only)</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <Field label="Theme">
            <select className="ss-select" value={settings.theme} onChange={(e) => update({ theme: e.target.value as ExtensionSettings['theme'] })}>
              <option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option>
            </select>
          </Field>
          <Field label="Density">
            <select className="ss-select" value={settings.density} onChange={(e) => update({ density: e.target.value as ExtensionSettings['density'] })}>
              <option value="compact">Compact</option><option value="comfortable">Comfortable</option>
            </select>
          </Field>
          <Field label="Default report tab">
            <select className="ss-select" value={settings.defaultTab} onChange={(e) => update({ defaultTab: e.target.value })}>
              {TABS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          <Field label="Title min chars"><input className="ss-input" type="number" value={settings.titleMin} onChange={(e) => update({ titleMin: Number(e.target.value) })} /></Field>
          <Field label="Title max chars"><input className="ss-input" type="number" value={settings.titleMax} onChange={(e) => update({ titleMax: Number(e.target.value) })} /></Field>
          <Field label="Description min"><input className="ss-input" type="number" value={settings.descriptionMin} onChange={(e) => update({ descriptionMin: Number(e.target.value) })} /></Field>
          <Field label="Description max"><input className="ss-input" type="number" value={settings.descriptionMax} onChange={(e) => update({ descriptionMax: Number(e.target.value) })} /></Field>
          <Field label="Large image ≥ px"><input className="ss-input" type="number" value={settings.largeImageMinWidth} onChange={(e) => update({ largeImageMinWidth: Number(e.target.value) })} /></Field>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" checked={settings.exportIncludeQuery} onChange={(e) => update({ exportIncludeQuery: e.target.checked })} />
          Skip the “query parameters” warning on export
        </label>
        {saved ? <div role="status" style={{ color: 'var(--accent)' }}>Saved ✓</div> : null}
      </div>
      <div className="ss-surface" style={{ padding: 12, display: 'grid', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 13 }}>Local report history (disabled by default)</h3>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" checked={settings.historyEnabled} onChange={(e) => update({ historyEnabled: e.target.checked })} />
          Keep recent reports on this device (max {settings.historyLimit}, URLs without queries)
        </label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Field label="History limit"><input className="ss-input" type="number" min={1} max={50} value={settings.historyLimit} onChange={(e) => update({ historyLimit: Number(e.target.value) })} /></Field>
          <span className="ss-muted" style={{ fontSize: 12 }}>Stored: {props.historyCount} · never synced, never uploaded.</span>
          <button type="button" className="ss-ghost-btn" onClick={async () => { await clearHistory(); props.setHistoryCount(0); }} style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Trash2 size={14} aria-hidden="true" /> Clear history</button>
          <button type="button" className="ss-ghost-btn" onClick={async () => { const d = await resetSettings(); setSettings(d); }}>Reset settings</button>
        </div>
      </div>
      <div className="ss-surface" style={{ padding: 12 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 13 }}>Privacy &amp; permissions</h3>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }} className="ss-muted">
          <li>Permissions: <span className="ss-mono">activeTab, scripting, storage</span> + optional narrow host access only when you use “Check robots.txt”.</li>
          <li>No backend, analytics, ads, AI calls, history collection or remote storage. Analysis runs in your browser.</li>
          <li>Never reads form values, cookies, local/session storage or auth tokens; never executes page scripts.</li>
          <li>Content Security Policy: <span className="ss-mono">script-src 'self'; object-src 'self'</span>.</li>
        </ul>
      </div>
      <div className="ss-surface" style={{ padding: 12 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 13 }}>About SiteScope <VersionTag /></h3>
        <p style={{ margin: '0 0 4px', fontSize: 12.5 }}>Made and designed by Abhinav Goyal and GoldenHour Delhi.</p>
        <p className="ss-muted" style={{ margin: '0 0 8px', fontSize: 12 }}>Copyright © 2026 Abhinav Goyal and GoldenHour Delhi. All rights reserved. Original code is MIT-licensed; third-party components keep their own licenses (see NOTICE.md).</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a className="ss-ghost-btn" style={{ textDecoration: 'none' }} href="#support">Support SiteScope</a>
          <a className="ss-ghost-btn" style={{ textDecoration: 'none' }} href="#resources">External resources</a>
        </div>
      </div>
    </div>
  );
}

function hostOf(r: AnalysisResult): string {
  try {
    return new URL(r.pageUrl).hostname;
  } catch {
    return 'page';
  }
}
