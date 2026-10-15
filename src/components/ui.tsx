import React from 'react';
import type { Severity } from '../types';

export function Badge({ severity, children }: { severity: Severity | string; children?: React.ReactNode }) {
  const label = children ?? severity;
  const icon = severity === 'critical' ? '● ' : severity === 'warning' ? '▲ ' : severity === 'passed' ? '✓ ' : 'ℹ ';
  return (
    <span className={`ss-badge ss-badge-${severity}`} aria-label={`severity ${severity}`}>
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="ss-surface" style={{ padding: 16, textAlign: 'center' }} role="status">
      <div style={{ fontWeight: 650 }}>{title}</div>
      {hint ? <div className="ss-muted" style={{ marginTop: 6 }}>{hint}</div> : null}
    </div>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" style={{ padding: 16, textAlign: 'center' }}>
      <div aria-hidden="true" style={{ fontSize: 20 }}>◌</div>
      <div>{label}</div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
      <span className="ss-muted">{label}</span>
      {children}
    </label>
  );
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <button
      type="button"
      className="ss-ghost-btn"
      aria-label={`Copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          globalThis.setTimeout(() => setDone(false), 1200);
        } catch {
          // Clipboard may be unavailable; fall back to selection prompt
          globalThis.prompt?.(`Copy ${label}:`, value);
        }
      }}
    >
      {done ? 'Copied ✓' : `Copy ${label}`}
    </button>
  );
}
