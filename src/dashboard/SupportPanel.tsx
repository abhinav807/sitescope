/**
 * Copyright © 2026 Abhinav Goyal and GoldenHour Delhi. All rights reserved.
 *
 * SupportPanel — the premium "Support SiteScope" experience. Warm, friendly,
 * and fully offline: the UPI QR is bundled locally, there is no tracking, and
 * nothing here phones home. Never initiates a payment; the user scans only if
 * they choose to.
 */
import React from 'react';
import { Coffee, HeartHandshake, Mail, ArrowLeft } from 'lucide-react';
import {
  ATTRIBUTION_SHORT,
  COPYRIGHT_LINE,
  PRODUCT_NAME,
  QR_ALT_TEXT,
  SUPPORT_CONTACTS,
  qrImageUrl,
} from '../lib/support';
import { CopyButton } from '../components/ui';
import { VersionTag } from '../components/ui';

function QrBlock() {
  const [missing, setMissing] = React.useState(false);
  if (missing) {
    return (
      <div
        role="img"
        aria-label="UPI QR code placeholder — the scannable code ships with the release build"
        style={{
          width: 220, height: 220, borderRadius: 14, border: '1px dashed #b89b5e',
          display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center',
          background: '#fffdf6', color: '#6b5a2e', padding: 16, textAlign: 'center',
        }}
      >
        <Coffee size={40} aria-hidden="true" />
        <span style={{ fontSize: 12.5 }}>UPI QR coming soon — the release build will include the scannable code.</span>
      </div>
    );
  }
  return (
    <img
      src={qrImageUrl()}
      alt={QR_ALT_TEXT}
      width={220}
      height={220}
      loading="lazy"
      onError={() => setMissing(true)}
      style={{
        width: 220, height: 220, objectFit: 'contain', borderRadius: 14,
        border: '1px solid #d9c48f', background: '#fffdf6', padding: 10,
      }}
    />
  );
}

export default function SupportPanel() {
  return (
    <div className="ss-support" style={{ display: 'grid', gap: 12 }}>
      <section className="ss-support-hero" aria-labelledby="support-title">
        <span className="ss-support-emblem" aria-hidden="true"><Coffee size={26} /></span>
        <div>
          <h2 id="support-title" style={{ margin: '0 0 2px', fontSize: 17 }}>Support {PRODUCT_NAME}</h2>
          <p className="ss-support-headline">Built with curiosity. Supported by chai. ☕</p>
          <p className="ss-support-lede">
            {PRODUCT_NAME} is built to make website inspection simpler, more transparent,
            and privacy-friendly. If you find it useful, you can support its continued
            development by buying me a chai. Every contribution is voluntary and appreciated.
          </p>
        </div>
      </section>

      <section className="ss-support-card" aria-labelledby="chai-title">
        <h3 id="chai-title"><HeartHandshake size={15} aria-hidden="true" /> Buy Me a Chai</h3>
        <div className="ss-support-chai">
          <QrBlock />
          <div style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
            <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 4 }}>
              <li>Open any UPI payment app on your phone.</li>
              <li>Choose “Scan QR” and point it at the code.</li>
              <li>Verify the recipient name shown <em>by your own app</em>, then pay any amount you like.</li>
            </ol>
            <p className="ss-support-note">
              Contributions are entirely optional. {PRODUCT_NAME} remains fully usable without payment.
              This page works offline — the QR image is bundled with the extension and nothing is tracked or sent anywhere.
            </p>
            <p style={{ margin: 0 }}>
              <a href="#overview" className="ss-ghost-btn" style={{ textDecoration: 'none', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <ArrowLeft size={14} aria-hidden="true" /> Back to {PRODUCT_NAME}
              </a>
            </p>
          </div>
        </div>
      </section>

      <section className="ss-support-card" aria-labelledby="contact-title">
        <h3 id="contact-title"><Mail size={15} aria-hidden="true" /> Contact &amp; support</h3>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
          {SUPPORT_CONTACTS.map((c) => (
            <li key={c.email} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="ss-muted" style={{ minWidth: 88 }}>{c.label}</span>
              <a className="ss-mono" href={`mailto:${c.email}`} style={{ color: 'inherit' }}>{c.email}</a>
              <CopyButton value={c.email} label={`${c.label} email`} />
            </li>
          ))}
        </ul>
        <p className="ss-support-note">For bugs, please include the extension version, your browser, and steps to reproduce — never passwords or private page contents.</p>
      </section>

      <section className="ss-support-card" aria-labelledby="about-title">
        <h3 id="about-title">About {PRODUCT_NAME}</h3>
        <dl className="ss-support-about">
          <dt>Version</dt><dd><VersionTag /></dd>
          <dt>Creator</dt><dd>Abhinav Goyal · GoldenHour Delhi</dd>
          <dt>Copyright</dt><dd>{COPYRIGHT_LINE}</dd>
          <dt>License</dt><dd>Original {PRODUCT_NAME} code is MIT-licensed (see LICENSE). Third-party components keep their own licenses (see NOTICE.md).</dd>
          <dt>Name</dt><dd>{PRODUCT_NAME} is the project’s claimed (unregistered) product name.</dd>
        </dl>
        <p className="ss-support-note">{ATTRIBUTION_SHORT}</p>
      </section>
    </div>
  );
}
