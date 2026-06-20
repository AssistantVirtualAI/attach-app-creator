import React, { useState } from 'react';
import { colors, font, radius, gradients } from '../lib/theme';
import { mobileApi } from '../lib/mobileApi';
import { Card, Chip, AIPanel, SectionTitle, PrimaryButton, GhostButton } from '../components/ui/Primitives';
import { AvaBadge } from '../components/Brand';

type Module = 'intelligence' | 'actions' | 'greetings' | 'queues' | 'agents';

const MODULES: { id: Module; label: string; desc: string; tone: 'violet' | 'cyan' | 'gold' | 'success' | 'danger' }[] = [
  { id: 'intelligence', label: 'Intelligence des appels', desc: 'Résumés, sentiment, sujets, opportunités, risques.', tone: 'violet' },
  { id: 'actions',      label: 'Centre des actions',      desc: 'Suivis extraits des appels et des messages.',       tone: 'cyan' },
  { id: 'greetings',    label: 'Studio de messages',      desc: "Génère des messages d'accueil SVI/messagerie avec ElevenLabs.", tone: 'gold' },
  { id: 'queues',       label: 'Constructeur de files',   desc: "Stratégie de routage, débordement, attente.",       tone: 'success' },
  { id: 'agents',       label: 'Agents vocaux',           desc: 'Assigner des agents vocaux AVA aux numéros et SVI.', tone: 'danger' },
];

export default function AIScreen() {
  const [active, setActive] = useState<Module>('intelligence');

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '14px 14px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.8, color: colors.avaViolet, textTransform: 'uppercase' }}>AVA AI</span>
        <AvaBadge compact />
      </div>
      <h1 style={{ fontSize: font.xxl, color: colors.textIce, margin: '0 0 6px', fontWeight: 800, letterSpacing: -0.3 }}>Espace IA</h1>
      <p style={{ fontSize: font.sm, color: colors.mutedSilver, margin: 0, lineHeight: 1.5 }}>
        Intelligence, automatisation et contrôle des agents vocaux pour vos communications d'affaires.
      </p>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '16px -14px 14px', padding: '0 14px' }}>
        {MODULES.map((m) => {
          const c = m.tone === 'violet' ? colors.avaViolet : m.tone === 'cyan' ? colors.avaCyan : m.tone === 'gold' ? colors.signalGold : m.tone === 'success' ? colors.success : colors.danger;
          const on = active === m.id;
          return (
            <button key={m.id} onClick={() => setActive(m.id)} style={{
              flexShrink: 0, padding: '8px 14px', borderRadius: 999,
              background: on ? `${c}1c` : 'transparent',
              border: `1px solid ${on ? c + '88' : colors.border}`,
              color: on ? c : colors.mutedSilver,
              fontSize: 11, fontWeight: 800, letterSpacing: 0.8, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>{m.label}</button>
          );
        })}
      </div>

      {active === 'intelligence' && <Intelligence />}
      {active === 'actions' && <Actions />}
      {active === 'greetings' && <Greetings />}
      {active === 'queues' && <Queues />}
      {active === 'agents' && <Agents />}

      <div style={{ height: 80 }} />
    </div>
  );
}

function Intelligence() {
  const rows = [
    { who: 'Marie Tremblay', score: 87, sent: 'Positif', topic: 'Renouvellement' },
    { who: 'Acme Corp',      score: 64, sent: 'Neutre',  topic: 'Report' },
    { who: 'Vincent K.',     score: 41, sent: 'Négatif', topic: 'Plainte' },
  ];
  return (
    <AIPanel title="Derniers appels analysés" accent={colors.avaViolet}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i === rows.length - 1 ? 'none' : `1px solid ${colors.border}` }}>
          <div>
            <div style={{ fontSize: font.base, fontWeight: 700, color: colors.textIce }}>{r.who}</div>
            <div style={{ fontSize: font.xs, color: colors.mutedSilver }}>{r.topic} · {r.sent}</div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: r.score > 70 ? colors.success : r.score > 50 ? colors.warning : colors.danger, fontFamily: 'JetBrains Mono, monospace' }}>{r.score}</div>
        </div>
      ))}
    </AIPanel>
  );
}

function Actions() {
  const items = [
    { who: 'Marie Tremblay', task: 'Envoyer le PDF des tarifs', due: "Aujourd'hui" },
    { who: 'Acme Corp',      task: 'Reporter la démo à jeudi', due: 'Demain' },
    { who: 'Sophie B.',      task: "Faire un suivi sur l'onboarding", due: '+3 jours' },
  ];
  return (
    <AIPanel title="Tâches à faire" accent={colors.avaCyan}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i === items.length - 1 ? 'none' : `1px solid ${colors.border}` }}>
          <span style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${colors.avaCyan}` }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: font.base, fontWeight: 600, color: colors.textIce }}>{it.task}</div>
            <div style={{ fontSize: font.xs, color: colors.mutedSilver }}>{it.who} · {it.due}</div>
          </div>
        </div>
      ))}
    </AIPanel>
  );
}

function Greetings() {
  const [prompt, setPrompt] = useState("Message d'accueil convivial hors heures pour notre ligne ventes");
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState(false);
  const gen = async () => {
    setBusy(true);
    const r = await mobileApi.generateGreeting(prompt);
    setOut(r.text); setBusy(false);
  };
  return (
    <Card padded={true} accent="gold">
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: colors.signalGold, textTransform: 'uppercase', marginBottom: 8 }}>Studio de messages</div>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} style={{
        width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 12,
        background: colors.midnight2, border: `1px solid ${colors.border}`,
        color: colors.textIce, fontSize: font.base, resize: 'vertical', fontFamily: 'inherit', outline: 'none',
      }} />
      <PrimaryButton onClick={gen} disabled={busy} style={{ marginTop: 10, width: '100%' }}>
        {busy ? 'Génération…' : '✨ Générer avec AVA'}
      </PrimaryButton>
      {out && (
        <div style={{ marginTop: 14, padding: 14, borderRadius: 12, background: colors.midnight2, border: `1px solid ${colors.borderAI}` }}>
          <div style={{ fontSize: 10, color: colors.avaCyan, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 6 }}>Script généré</div>
          <p style={{ fontSize: font.base, color: colors.textIce, lineHeight: 1.55, margin: 0 }}>{out}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <GhostButton tone="gold">🎙 Synthétiser</GhostButton>
            <GhostButton tone="cyan">Enregistrer comme SVI</GhostButton>
          </div>
        </div>
      )}
    </Card>
  );
}

function Queues() {
  const rows = [
    { q: 'Ventes',        wait: '42s',     sla: 88, rec: 'Ajouter 1 agent 13:00–15:00 — abandon +12 %' },
    { q: 'Support',       wait: '1m 18s',  sla: 71, rec: "Passer au routage 'plus longtemps inactif' — réduit l'attente d'environ 22 %" },
    { q: 'Hors heures',   wait: '—',       sla: 0,  rec: 'Activer un agent vocal AVA pour la capture de rappel' },
  ];
  return (
    <AIPanel title="Recommandations de files" accent={colors.success}>
      {rows.map((r, i) => (
        <div key={i} style={{ padding: '10px 0', borderBottom: i === rows.length - 1 ? 'none' : `1px solid ${colors.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: font.base, fontWeight: 700, color: colors.textIce }}>{r.q}</span>
            <span style={{ fontSize: font.xs, color: colors.mutedSilver, fontFamily: 'JetBrains Mono, monospace' }}>{r.wait} · SLA {r.sla}%</span>
          </div>
          <div style={{ fontSize: font.sm, color: colors.success, marginTop: 4 }}>↳ {r.rec}</div>
        </div>
      ))}
    </AIPanel>
  );
}

function Agents() {
  const agents = [
    { name: 'Réception AVA',          voice: 'ElevenLabs · Rachel', assigned: ['+1 514 555 0100', 'SVI → 0'] },
    { name: 'Repli hors heures',       voice: 'ElevenLabs · Adam',   assigned: ['Débordement de file > 60s'] },
    { name: 'Ligne espagnole',         voice: 'ElevenLabs · Mateo',  assigned: ['+1 514 555 0144'] },
  ];
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 4px 10px' }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.5, color: colors.danger, textTransform: 'uppercase' }}>Agents vocaux actifs</div>
        <GhostButton tone="violet" style={{ padding: '6px 10px' }}>+ Nouveau</GhostButton>
      </div>
      {agents.map((a, i) => (
        <Card key={i} style={{ marginBottom: 8 }} accent={i === 0 ? 'violet' : undefined}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ fontSize: font.base, fontWeight: 700, color: colors.textIce }}>{a.name}</div>
            <span style={{ fontSize: font.xs, color: colors.mutedSilver }}>{a.voice}</span>
          </div>
          <div style={{ fontSize: font.sm, color: colors.avaCyan, marginTop: 6, fontFamily: 'JetBrains Mono, monospace' }}>{a.assigned.join(' · ')}</div>
        </Card>
      ))}
    </>
  );
}
