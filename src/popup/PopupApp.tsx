import React from 'react';
import { ScanSearch, ExternalLink, ShieldCheck, TriangleAlert, Info, CircleCheck } from 'lucide-react';
import type { AnalysisResult } from '../types';
import { checkPageSupport } from '../lib/browser/capabilities';
import { extensionApi, getActiveTab, openDashboard, storageSet } from '../lib/browser/api';
import { requestAnalysisFromActiveTab } from '../lib/browser/messaging';
import { Badge, Loading } from '../components/ui';

type State =
  | { kind: 'idle'; url: string; title: string; supported: boolean; reason?: string }
  | { kind: 'loading'; url: string; title: string }
  | { kind: 'done'; result: AnalysisResult }
  | { kind: 'error'; message: string; url: string };

function Logo() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 26, height: 26, borderRadius: 8, background: '#c8f04a', color: '#1a2005',
        fontWeight: 800, fontSize: 15,
      }}
    >
      S
    </span>
  );
}

export default function PopupApp() {
  const [state, setState] = React.useState<State>({ kind: 'idle', url: '', title: '', supported: true });
  const [tabUrl, setTabUrl] = React.useState('');
  const [tabTitle, setTabTitle] = React.useState('');

  React.useEffect(() => {
    (async () => {
      const api = extensionApi();
      if (!api?.tabs) {
        setState({ kind: 'idle', url: '', title: '', supported: true });
        return;
      }
      const tab = await getActiveTab();
      const url = tab?.url ?? '';
      const title = tab?.title ?? '';
      setTabUrl(url);
      setTabTitle(title);
      const sup = checkPageSupport(url);
      setState({ kind: 'idle', url, title, supported: sup.supported, reason: sup.reason });
    })();
  }, []);

  const domain = React.useMemo(() => {
    try {
      return new URL(tabUrl || (state.kind !== 'error' && state.kind !== 'done' ? '' : '')).hostname || (tabUrl ? '(unparsable URL)' : '(no tab)');
    } catch {
      return tabUrl ? '(unparsable URL)' : '(no tab)';
    }
  }, [tabUrl, state]);

  async function analyze() {
    const cur = state;
    const url = cur.kind === 'idle' ? cur.url : tabUrl;
    const title = cur.kind === 'idle' ? cur.title : tabTitle;
    setState({ kind: 'loading', url, title });
    try {
      const result = await requestAnalysisFromActiveTab();
      try {
        await storageSet('sitescope:last-result', result);
      } catch {
        /* non-fatal */
      }
      setState({ kind: 'done', result });
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : String(e), url });
    }
  }

  function openFull() {
    void openDashboard();
  }

  return (
    <main style={{ width: 360, padding: 14, display: 'grid', gap: 12 }} aria-label="SiteScope popup">
      <header style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Logo />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 750, fontSize: 14 }}>SiteScope</div>
          <div className="ss-muted ss-mono" style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 250 }} title={tabUrl}>
            {domain}
          </div>
        </div>
        <span style={{ marginLeft: 'auto' }} className="ss-muted" title="Local-only analysis">
          <ShieldCheck size={16} aria-hidden="true" />
          <span className="sr-only">Private: analysis runs locally</span>
        </span>
      </header>

      {state.kind === 'idle' && !state.supported ? (
        <div className="ss-surface" style={{ padding: 14 }} role="alert">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700 }}>
            <TriangleAlert size={16} aria-hidden="true" /> Unsupported page
          </div>
          <p className="ss-muted">{state.reason}</p>
          <p className="ss-muted" style={{ fontSize: 12 }}>
            Open a regular http(s) website, then reopen SiteScope. Internal browser pages, the web store and PDFs cannot be inspected.
          </p>
        </div>
      ) : null}

      {state.kind === 'idle' && state.supported ? (
        <>
          <div className="ss-surface" style={{ padding: 12 }}>
            <div className="ss-muted" style={{ fontSize: 11 }}>CURRENT PAGE</div>
            <div style={{ fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={state.title}>
              {state.title || '(no title)'}
            </div>
            <div className="ss-mono ss-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={state.url}>
              {state.url || 'Open a website to begin.'}
            </div>
          </div>
          <button type="button" className="ss-accent-btn" onClick={analyze} disabled={!state.url} style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
            <ScanSearch size={16} aria-hidden="true" /> Analyze page
          </button>
          <p className="ss-muted" style={{ fontSize: 11, margin: 0 }}>
            Runs locally in your browser. Nothing is uploaded. First run? No account needed.
          </p>
        </>
      ) : null}

      {state.kind === 'loading' ? <Loading label="Analyzing page…" /> : null}

      {state.kind === 'error' ? (
        <div className="ss-surface" style={{ padding: 14 }} role="alert">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700 }}>
            <TriangleAlert size={16} aria-hidden="true" /> Analysis failed
          </div>
          <p>{state.message}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="ss-accent-btn" onClick={analyze}>Retry</button>
            <button type="button" className="ss-ghost-btn" onClick={openFull}>Open report</button>
          </div>
        </div>
      ) : null}

      {state.kind === 'done' ? (
        <ResultSummary
          result={state.result}
          onReanalyze={analyze}
          onOpenFull={openFull}
        />
      ) : null}

      <footer className="ss-muted" style={{ fontSize: 11, display: 'grid', gap: 2 }}>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Info size={12} aria-hidden="true" />
          <span>Free · No ads · No tracking. <a href="dashboard/dashboard.html#settings" target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>Privacy &amp; settings</a></span>
        </span>
        <span title="Made and designed by Abhinav Goyal and GoldenHour Delhi">Made and designed by Abhinav Goyal and GoldenHour Delhi · <a href="dashboard/dashboard.html#support" target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>Support</a></span>
      </footer>
    </main>
  );
}

function ResultSummary({ result, onReanalyze, onOpenFull }: { result: AnalysisResult; onReanalyze: () => void; onOpenFull: () => void }) {
  const top = [...result.findings]
    .sort((a, b) => sevRank(a.severity) - sevRank(b.severity))
    .slice(0, 5);
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="ss-surface" style={{ padding: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
        <StatusCounts result={result} />
      </div>
      <div style={{ display: 'grid', gap: 6 }} aria-live="polite">
        {top.map((f) => (
          <div key={f.id} className="ss-surface" style={{ padding: 8, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <Badge severity={f.severity} />
            <span style={{ fontSize: 12 }}>{f.title}</span>
          </div>
        ))}
        {top.length === 0 ? <div className="ss-muted">No findings.</div> : null}
      </div>
      <nav aria-label="Quick links" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {['seo', 'links', 'images', 'technical'].map((t) => (
          <a key={t} className="ss-ghost-btn" style={{ textDecoration: 'none', fontSize: 12 }} href={`dashboard/dashboard.html#${t}`} target="_blank" rel="noreferrer">
            {t[0].toUpperCase() + t.slice(1)}
          </a>
        ))}
      </nav>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="ss-accent-btn" onClick={onOpenFull} style={{ flex: 1, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
          Open full report <ExternalLink size={14} aria-hidden="true" />
        </button>
        <button type="button" className="ss-ghost-btn" onClick={onReanalyze}>Re-analyze</button>
      </div>
      <div className="ss-muted ss-mono" style={{ fontSize: 11 }}>
        {result.pageTitle} · {result.summary.critical} critical · {result.summary.warning} warnings
      </div>
    </div>
  );
}

function StatusCounts({ result }: { result: AnalysisResult }) {
  const s = result.summary;
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12 }} role="status" aria-label="Issue counts">
      <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><TriangleAlert size={14} aria-hidden="true" color="#f08787" /> {s.critical} critical</span>
      <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><TriangleAlert size={14} aria-hidden="true" color="#e8c547" /> {s.warning} warnings</span>
      <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><CircleCheck size={14} aria-hidden="true" color="#8fe388" /> {s.passed} passed</span>
    </div>
  );
}

function sevRank(s: string): number {
  return s === 'critical' ? 0 : s === 'warning' ? 1 : s === 'info' ? 2 : 3;
}
