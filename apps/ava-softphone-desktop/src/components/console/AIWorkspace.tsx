import React, { useState } from 'react';
import { theme } from '../../lib/theme';
import { ava } from '../../lib/avaApi';
import PageHeader from './PageHeader';
import AIInsights from '../AIInsights';

const { colors: c } = theme;

type Module = 'intelligence' | 'transcripts' | 'greetings' | 'queues' | 'agents' | 'coaching';

const MODULES: { id: Module; label: string; desc: string; accent: string }[] = [
  { id: 'intelligence', label: 'Call Intelligence', desc: 'Summaries, sentiment, topics, action items, risks, opportunities.', accent: '#7A4CFF' },
  { id: 'transcripts',  label: 'Transcript Search', desc: 'Search across calls and messages by intent, topic, or keyword.', accent: '#23D6FF' },
  { id: 'greetings',    label: 'Greeting Studio', desc: 'Generate IVR / voicemail / queue greetings through AVA + ElevenLabs.', accent: '#FFE600' },
  { id: 'queues',       label: 'Queue Optimizer', desc: 'Recommendations for strategy, overflow, staffing, hold messaging.', accent: '#28E6A5' },
  { id: 'agents',       label: 'Voice Agent Manager', desc: 'Assign AVA voice agents to numbers, IVRs, queues, after-hours.', accent: '#FF4D67' },
  { id: 'coaching',     label: 'Coaching Insights', desc: 'Missed opportunities, escalations, objections, quality issues.', accent: '#FFCC33' },
];

export default function AIWorkspace() {
  const [active, setActive] = useState<Module>('intelligence');
  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto', animation: 'fadeIn .3s ease-out' }}>
      <PageHeader
        eyebrow="Powered by AVA AI"
        title="AI Workspace"
        subtitle="Intelligence, automation, and voice-agent control for your communications."
        accent={c.avaViolet}
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M12 2l1.8 4.5L18 8l-4.2 1.5L12 14l-1.8-4.5L6 8l4.2-1.5L12 2z"/><path d="M18 14l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z"/></svg>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 22 }}>
        {MODULES.map((m) => (
          <button key={m.id} onClick={() => setActive(m.id)} style={{
            textAlign: 'left', padding: 16, borderRadius: 14,
            background: active === m.id ? `linear-gradient(135deg, ${m.accent}1c, transparent)` : c.bgCard,
            border: `1px solid ${active === m.id ? m.accent + '60' : c.border}`,
            cursor: 'pointer', color: c.textIce, transition: 'all 160ms ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.accent, boxShadow: `0 0 10px ${m.accent}` }} />
              <span style={{ fontSize: 13.5, fontWeight: 700 }}>{m.label}</span>
            </div>
            <p style={{ fontSize: 11.5, color: c.mutedSilver, margin: 0, lineHeight: 1.5 }}>{m.desc}</p>
          </button>
        ))}
      </div>

      <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 14, padding: 22 }}>
        {active === 'intelligence' && <Intelligence />}
        {active === 'transcripts' && <Transcripts />}
        {active === 'greetings' && <Greetings />}
        {active === 'queues' && <QueueOptimizer />}
        {active === 'agents' && <VoiceAgentManager />}
        {active === 'coaching' && <CoachingInsights />}
      </div>
    </div>
  );
}

function Intelligence() {
  return <AIInsights />;
}

function Transcripts() {
  const [q, setQ] = useState('');
  return (
    <>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search transcripts by intent, topic, customer…" style={{
        width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 10,
        background: c.midnight, border: `1px solid ${c.borderAI}`, color: c.textIce, fontSize: 13, outline: 'none', marginBottom: 14,
      }} />
      {q.trim() ? (
        <div style={{ fontSize: 12, color: c.mutedSilver }}>3 matches for "{q}" — connect AVA backend to enable semantic search.</div>
      ) : (
        <div style={{ fontSize: 12, color: c.mutedSilver }}>Type a query to search across all call transcripts and messages.</div>
      )}
    </>
  );
}

function Greetings() {
  const [prompt, setPrompt] = useState('Friendly after-hours greeting for our sales line');
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState(false);
  const gen = async () => {
    setBusy(true);
    const r = await ava.generateGreeting(prompt);
    setOut(r.text);
    setBusy(false);
  };
  return (
    <>
      <label style={{ fontSize: 11, color: c.mutedSilver, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Describe the greeting</label>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} style={{
        width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 10, marginTop: 6,
        background: c.midnight, border: `1px solid ${c.border}`, color: c.textIce, fontSize: 13, resize: 'vertical', fontFamily: 'inherit', outline: 'none',
      }} />
      <button onClick={gen} disabled={busy} style={{
        marginTop: 10, padding: '10px 18px', borderRadius: 10,
        background: `linear-gradient(135deg, ${c.avaViolet}, ${c.avaCyan})`,
        border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
      }}>{busy ? 'Generating…' : '✨ Generate with AVA'}</button>
      {out && (
        <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: c.midnight, border: `1px solid ${c.borderAI}` }}>
          <div style={{ fontSize: 10, color: c.avaCyan, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>Generated Script</div>
          <p style={{ fontSize: 13, color: c.textIce, lineHeight: 1.6, margin: 0 }}>{out}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button style={{ padding: '6px 12px', borderRadius: 8, background: 'transparent', border: `1px solid ${c.signalGold}`, color: c.signalGold, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>🎙 Synthesize voice</button>
            <button style={{ padding: '6px 12px', borderRadius: 8, background: 'transparent', border: `1px solid ${c.border}`, color: c.mutedSilver, fontSize: 11, cursor: 'pointer' }}>Save as IVR greeting</button>
          </div>
        </div>
      )}
    </>
  );
}

function QueueOptimizer() {
  const rows = [
    { q: 'Sales', wait: '42s', sla: 88, rec: 'Add 1 agent 13:00–15:00 — abandonment +12%' },
    { q: 'Support', wait: '1m 18s', sla: 71, rec: 'Switch to longest-idle routing — reduces wait ~22%' },
    { q: 'After-hours', wait: '—', sla: 0, rec: 'Enable AVA voice agent for callback capture' },
  ];
  return (
    <>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#28E6A5', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>Last 30 days</div>
      {rows.map((r, i) => (
        <div key={i} style={{ padding: '12px 0', borderBottom: `1px solid ${c.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.textIce }}>{r.q}</div>
            <div style={{ fontSize: 11, color: c.mutedSilver, fontFamily: 'JetBrains Mono, monospace' }}>avg wait {r.wait} · SLA {r.sla}%</div>
          </div>
          <div style={{ fontSize: 12, color: '#28E6A5', marginTop: 4 }}>↳ {r.rec}</div>
        </div>
      ))}
    </>
  );
}

function VoiceAgentManager() {
  const agents = [
    { name: 'AVA Reception', voice: 'ElevenLabs · Rachel', assigned: ['+1 514 555 0100', 'IVR → Press 0'] },
    { name: 'After-hours fallback', voice: 'ElevenLabs · Adam', assigned: ['Queue overflow > 60s'] },
    { name: 'Spanish line', voice: 'ElevenLabs · Mateo', assigned: ['+1 514 555 0144'] },
  ];
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#FF4D67', letterSpacing: 1.5, textTransform: 'uppercase' }}>Active voice agents</div>
        <button style={{ padding: '6px 12px', borderRadius: 8, background: 'transparent', border: `1px solid #FF4D6770`, color: '#FF4D67', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+ New agent</button>
      </div>
      {agents.map((a, i) => (
        <div key={i} style={{ padding: 12, marginBottom: 8, borderRadius: 10, background: c.midnight, border: `1px solid ${c.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.textIce }}>{a.name}</div>
            <div style={{ fontSize: 10.5, color: c.mutedSilver }}>{a.voice}</div>
          </div>
          <div style={{ fontSize: 11, color: c.avaCyan, marginTop: 6, fontFamily: 'JetBrains Mono, monospace' }}>
            {a.assigned.join(' · ')}
          </div>
        </div>
      ))}
    </>
  );
}

function CoachingInsights() {
  const items = [
    { agent: 'Sarah L.', kind: 'Opportunity', detail: '3 missed upsell cues on renewal calls this week.', tone: '#FFCC33' },
    { agent: 'Mohamed K.', kind: 'Escalation', detail: 'Hold time avg 1m 48s vs team 38s — review call #4821.', tone: '#FF4D67' },
    { agent: 'Team', kind: 'Objection', detail: '"Price too high" raised in 27% of demos — playbook missing.', tone: '#23D6FF' },
  ];
  return (
    <>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#FFCC33', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>This week</div>
      {items.map((r, i) => (
        <div key={i} style={{ padding: '12px 0', borderBottom: `1px solid ${c.border}`, display: 'flex', gap: 14 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: r.tone, letterSpacing: 1.5, minWidth: 90, paddingTop: 2 }}>{r.kind.toUpperCase()}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, color: c.textIce }}>{r.agent}</div>
            <div style={{ fontSize: 12, color: c.mutedSilver, marginTop: 2 }}>{r.detail}</div>
          </div>
        </div>
      ))}
    </>
  );
}

function PlaceholderModule({ title, hint }: { title: string; hint: string }) {
  return (
    <div style={{ padding: '20px 4px', textAlign: 'center' }}>
      <h3 style={{ fontSize: 16, color: c.textIce, margin: '0 0 6px' }}>{title}</h3>
      <p style={{ fontSize: 12, color: c.mutedSilver, margin: 0 }}>{hint}</p>
    </div>
  );
}
