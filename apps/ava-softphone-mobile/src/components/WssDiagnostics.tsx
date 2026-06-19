import React, { useState } from 'react';
import { buildWssFallbackList, type SIPConfig } from '../lib/sip/jssipProvider';

type Result = {
  url: string;
  state: 'pending' | 'ok' | 'fail';
  ms?: number;
  reason?: string;
};

function classifyWsFailure(url: string): string {
  // Browsers do NOT expose detailed TLS error info to JS for security reasons.
  // If wss:// fails to open but the host/port is reachable, it is almost
  // always: invalid SSL certificate, blocked port, or server down.
  return (
    'Connection refused or rejected. Most common cause on port 7443: ' +
    'the WSS endpoint is using a self-signed or untrusted SSL certificate ' +
    'that mobile browsers refuse. Verify by opening ' +
    url.replace('wss://', 'https://') +
    ' in a new tab — if the browser warns about the certificate, install a CA-signed (Let\'s Encrypt) certificate.'
  );
}

function probe(url: string, timeoutMs = 5000): Promise<Result> {
  return new Promise((resolve) => {
    const started = Date.now();
    let settled = false;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url, 'sip');
    } catch (e: any) {
      resolve({ url, state: 'fail', reason: e?.message || 'WebSocket constructor failed' });
      return;
    }
    const done = (r: Result) => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch {}
      resolve(r);
    };
    const timer = setTimeout(
      () => done({ url, state: 'fail', ms: Date.now() - started, reason: 'Timeout — server did not respond within ' + timeoutMs + 'ms' }),
      timeoutMs,
    );
    ws.onopen = () => { clearTimeout(timer); done({ url, state: 'ok', ms: Date.now() - started }); };
    ws.onerror = () => { clearTimeout(timer); done({ url, state: 'fail', ms: Date.now() - started, reason: classifyWsFailure(url) }); };
    ws.onclose = (ev) => {
      if (settled) return;
      clearTimeout(timer);
      if (ev.code === 1000 || ev.code === 1005) done({ url, state: 'ok', ms: Date.now() - started });
      else done({ url, state: 'fail', ms: Date.now() - started, reason: `Closed (code ${ev.code}). ${classifyWsFailure(url)}` });
    };
  });
}

export default function WssDiagnostics({
  config,
  onClose,
}: {
  config: SIPConfig | null;
  onClose: () => void;
}) {
  const urls = config ? buildWssFallbackList(config) : [];
  const [results, setResults] = useState<Result[]>(urls.map((url) => ({ url, state: 'pending' })));
  const [running, setRunning] = useState(false);

  const run = async () => {
    if (!config) return;
    setRunning(true);
    setResults(urls.map((url) => ({ url, state: 'pending' })));
    for (let i = 0; i < urls.length; i++) {
      const r = await probe(urls[i]);
      setResults((prev) => prev.map((p, idx) => (idx === i ? r : p)));
    }
    setRunning(false);
  };

  return (
    <div role="dialog" aria-modal="true" style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(8,14,30,0.92)', backdropFilter: 'blur(14px)',
      display: 'flex', flexDirection: 'column',
      paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)',
      color: '#fff',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>WSS Diagnostics</div>
        <button onClick={onClose} aria-label="Close" style={{
          background: 'rgba(255,255,255,0.12)', color: '#fff', border: 'none',
          borderRadius: 999, width: 36, height: 36, fontSize: 18, cursor: 'pointer',
        }}>✕</button>
      </div>

      <div style={{ padding: '0 16px 12px', fontSize: 12, opacity: 0.8 }}>
        Tests each known SIP WebSocket endpoint and reports the failure reason.
        Browsers hide TLS error details; a failed connection on port 7443 almost
        always means the SSL certificate is invalid or self-signed.
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
        {!config && (
          <div style={{ padding: 16, background: 'rgba(239,68,68,0.12)', borderRadius: 12, color: '#fca5a5' }}>
            SIP configuration not loaded yet — sign in and wait for the credentials to hydrate.
          </div>
        )}
        {results.map((r, i) => (
          <div key={i} style={{
            margin: '8px 0', padding: 12, borderRadius: 12,
            background: r.state === 'ok' ? 'rgba(34,197,94,0.10)' : r.state === 'fail' ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.10)',
            border: `1px solid ${r.state === 'ok' ? '#22c55e55' : r.state === 'fail' ? '#ef444455' : '#f59e0b55'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <code style={{ fontSize: 12, wordBreak: 'break-all' }}>{r.url}</code>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                background: r.state === 'ok' ? '#22c55e' : r.state === 'fail' ? '#ef4444' : '#f59e0b',
                color: '#0a0f1f',
              }}>
                {r.state === 'ok' ? `OK ${r.ms}ms` : r.state === 'fail' ? 'FAIL' : 'pending'}
              </span>
            </div>
            {r.reason && (
              <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.4, opacity: 0.9 }}>{r.reason}</div>
            )}
          </div>
        ))}
      </div>

      <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 10, lineHeight: 1.45 }}>
          <strong>Admin fix for SSL errors:</strong> install a CA-signed certificate on
          the WSS port. On the PBX server, run:
          <pre style={{
            margin: '6px 0 0', padding: 8, background: 'rgba(0,0,0,0.35)', borderRadius: 8,
            fontSize: 11, overflowX: 'auto',
          }}>{`sudo certbot certonly --standalone -d node.lemtelcloud.net
# point FusionPBX/Kamailio to:
#   /etc/letsencrypt/live/node.lemtelcloud.net/fullchain.pem
#   /etc/letsencrypt/live/node.lemtelcloud.net/privkey.pem
# then restart freeswitch / kamailio listening on :7443`}</pre>
        </div>
        <button
          onClick={run}
          disabled={running || !config}
          style={{
            width: '100%', padding: '12px 16px', borderRadius: 12, border: 'none',
            background: running ? 'rgba(59,130,246,0.4)' : 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
            color: '#fff', fontWeight: 700, fontSize: 14,
            cursor: running ? 'wait' : 'pointer',
          }}
        >
          {running ? 'Testing endpoints…' : 'Run diagnostics'}
        </button>
      </div>
    </div>
  );
}
