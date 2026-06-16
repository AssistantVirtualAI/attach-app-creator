// Unified PBX edit sheet (portal-parity). Opaque navy panel, sticky header/footer,
// scrollable body, grouped sections, rich field types incl. ElevenLabs TTS preview.
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { theme } from '../../../lib/theme';
import { supabase } from '../../../lib/supabaseClient';

const { colors: c } = theme;

export type FieldType =
  | 'text' | 'number' | 'textarea' | 'select' | 'checkbox'
  | 'password' | 'tts-greeting';

export interface FieldDef {
  key: string;
  label: string;
  type?: FieldType;
  options?: (string | { value: string; label: string })[];
  placeholder?: string;
  hint?: string;
  required?: boolean;
  cols?: 1 | 2;            // half / full width inside group grid
  // tts-greeting: when generation succeeds, sets this key with returned filename/path text
  ttsFilenameSuggestion?: (form: any) => string;
}

export interface FieldGroup {
  section: string;
  description?: string;
  fields: FieldDef[];
}

interface Props {
  title: string;
  groups: FieldGroup[];
  initial: any;
  saving?: boolean;
  width?: number;
  onCancel: () => void;
  onSave: (record: any) => void;
}

const TOP_VOICES: { id: string; name: string }[] = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George' },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel' },
];

const inputBase: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '9px 11px', borderRadius: 10,
  background: '#0a1430',
  border: `1px solid ${c.border}`,
  color: c.textIce, fontSize: 13, outline: 'none',
  fontFamily: 'inherit',
};
const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, letterSpacing: 1,
  color: c.mutedSilver, textTransform: 'uppercase', marginBottom: 6,
};

function FieldRenderer({ f, value, onChange, fullForm }: {
  f: FieldDef; value: any; onChange: (v: any) => void; fullForm: any;
}) {
  if (f.type === 'textarea') {
    return (
      <textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder}
        rows={4}
        style={{ ...inputBase, minHeight: 90, resize: 'vertical' }} />
    );
  }
  if (f.type === 'select') {
    return (
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} style={inputBase}>
        <option value="">—</option>
        {(f.options || []).map((o) => {
          const v = typeof o === 'string' ? o : o.value;
          const l = typeof o === 'string' ? o : o.label;
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    );
  }
  if (f.type === 'checkbox') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: c.textIce, fontSize: 13, padding: '6px 0' }}>
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        <span>{f.hint || 'Enabled'}</span>
      </label>
    );
  }
  if (f.type === 'tts-greeting') {
    return <TtsGreetingField value={value} onChange={onChange} field={f} fullForm={fullForm} />;
  }
  return (
    <input
      type={f.type === 'number' ? 'number' : f.type === 'password' ? 'password' : 'text'}
      value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder}
      style={inputBase} autoComplete="off"
    />
  );
}

function TtsGreetingField({ value, onChange, field, fullForm }: {
  value: any; onChange: (v: any) => void; field: FieldDef; fullForm: any;
}) {
  const [voice, setVoice] = useState(TOP_VOICES[0].id);
  const [text, setText] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const filename = useMemo(() => {
    const suggest = field.ttsFilenameSuggestion?.(fullForm);
    return suggest || `tts-${field.key}-${Date.now()}.mp3`;
  }, [field, fullForm]);

  const generate = async () => {
    if (!text.trim()) { setErr('Enter greeting text'); return; }
    setBusy(true); setErr(null);
    try {
      const { data, error } = await supabase.functions.invoke('voicemail-greeting-tts', {
        body: { text, voiceId: voice, language: 'en' },
      });
      if (error) throw error;
      if (!data?.audioContent) throw new Error(data?.error || 'No audio returned');
      const url = `data:audio/mpeg;base64,${data.audioContent}`;
      setAudioUrl(url);
      // Stash filename suggestion into the field value for PBX path
      onChange(filename);
    } catch (e: any) {
      setErr(e?.message || 'TTS failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      border: `1px solid ${c.border}`, borderRadius: 10, padding: 12,
      background: 'rgba(11,181,214,0.04)', display: 'grid', gap: 10,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 8 }}>
        <input value={value ?? ''} onChange={(e) => onChange(e.target.value)}
          placeholder="Filename or path on PBX (e.g. welcome.wav)"
          style={inputBase} />
        <select value={voice} onChange={(e) => setVoice(e.target.value)} style={inputBase}>
          {TOP_VOICES.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)}
        placeholder="Type the greeting — ElevenLabs will read it back."
        rows={3} style={{ ...inputBase, minHeight: 72, resize: 'vertical' }} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" onClick={generate} disabled={busy}
          style={{
            padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
            border: 'none', cursor: 'pointer', color: '#fff',
            background: `linear-gradient(135deg, ${c.lemtelBlue}, ${c.avaViolet})`,
            opacity: busy ? 0.6 : 1,
          }}>{busy ? 'Generating…' : '🎙 Generate with AI'}</button>
        {audioUrl && (
          <>
            <audio src={audioUrl} controls style={{ height: 32 }} />
            <a href={audioUrl} download={filename} style={{ fontSize: 11, color: c.avaCyan, textDecoration: 'underline' }}>
              Download {filename}
            </a>
          </>
        )}
        {err && <span style={{ color: c.danger, fontSize: 11 }}>{err}</span>}
      </div>
      <div style={{ fontSize: 10, color: c.mutedSilver, lineHeight: 1.5 }}>
        Tip: download the MP3, upload it to FusionPBX Recordings, then set the filename above.
      </div>
    </div>
  );
}

export default function PbxEditSheet({
  title, groups, initial, saving, width = 620, onCancel, onSave,
}: Props) {
  const [form, setForm] = useState<any>(initial || {});
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onCancel]);

  return createPortal(
    <div onClick={onCancel} style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(2,6,20,0.72)',
      display: 'flex', justifyContent: 'flex-end',
      animation: 'fadeIn 140ms ease-out',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: `min(${width}px, 100%)`, height: '100%',
        background: '#0c1733',                       // OPAQUE
        borderLeft: `1px solid ${c.border}`,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-30px 0 80px rgba(0,0,0,0.6)',
        animation: 'slideInRight 180ms cubic-bezier(.2,.8,.2,1)',
      }}>
        {/* Sticky header */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 2,
          padding: '16px 22px', borderBottom: `1px solid ${c.border}`,
          background: '#0c1733',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: c.textIce, letterSpacing: 0.2 }}>{title}</h2>
          <button onClick={onCancel} aria-label="Close" style={{
            width: 30, height: 30, borderRadius: 8, border: `1px solid ${c.border}`,
            background: 'transparent', color: c.mutedSilver, cursor: 'pointer', fontSize: 14,
          }}>✕</button>
        </header>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
          {groups.map((g) => (
            <section key={g.section} style={{ marginBottom: 22 }}>
              <div style={{
                fontSize: 10, fontWeight: 800, letterSpacing: 1.4,
                color: c.signalGold, textTransform: 'uppercase', marginBottom: 10,
                paddingBottom: 6, borderBottom: `1px solid ${c.border}`,
              }}>{g.section}</div>
              {g.description && (
                <div style={{ fontSize: 11, color: c.mutedSilver, marginBottom: 12 }}>{g.description}</div>
              )}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14,
              }}>
                {g.fields.map((f) => (
                  <div key={f.key} style={{ gridColumn: (f.cols === 1) ? 'span 1' : 'span 2' }}>
                    <div style={labelStyle}>{f.label}{f.required && <span style={{ color: c.danger }}> *</span>}</div>
                    <FieldRenderer f={f} value={form[f.key]} fullForm={form}
                      onChange={(v) => setForm({ ...form, [f.key]: v })} />
                    {f.hint && f.type !== 'checkbox' && (
                      <div style={{ fontSize: 10, color: c.mutedSilver, marginTop: 4 }}>{f.hint}</div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Sticky footer */}
        <footer style={{
          position: 'sticky', bottom: 0, zIndex: 2,
          padding: '14px 22px', borderTop: `1px solid ${c.border}`,
          background: '#0c1733',
          display: 'flex', gap: 10, justifyContent: 'flex-end',
        }}>
          <button onClick={onCancel} style={{
            padding: '9px 16px', borderRadius: 10, background: 'transparent',
            border: `1px solid ${c.border}`, color: c.textIce,
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={() => onSave(form)} disabled={saving} style={{
            padding: '9px 20px', borderRadius: 10, border: 'none',
            color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer',
            background: `linear-gradient(135deg, ${c.lemtelBlue}, ${c.avaViolet})`,
            opacity: saving ? 0.6 : 1,
          }}>{saving ? 'Saving…' : 'Save & sync to PBX'}</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
