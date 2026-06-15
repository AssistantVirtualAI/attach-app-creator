import React, { useEffect, useRef, useState } from 'react';
import { theme } from '../lib/theme';
import { supabase } from '../lib/supabaseClient';
import { setAuthToken } from '../lib/avaApi';

const { colors: c } = theme;

type Status = 'available' | 'busy' | 'meeting' | 'away';

const STATUS_META: Record<Status, { label: string; color: string; manual: 'available' | 'dnd' | 'away' }> = {
  available: { label: 'Available',    color: '#22c55e', manual: 'available' },
  busy:      { label: 'Busy',         color: '#ef4444', manual: 'dnd' },
  meeting:   { label: 'In a meeting', color: '#f59e0b', manual: 'dnd' },
  away:      { label: 'Not available',color: '#94a3b8', manual: 'away' },
};

const AVATAR_KEY = 'lemtel:user-avatar';
const STATUS_KEY = 'lemtel:user-status';

const MEETING_NOTE_KEY = 'lemtel:meeting-note';

export default function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>(() => (localStorage.getItem(STATUS_KEY) as Status) || 'available');
  const [avatar, setAvatar] = useState<string | null>(() => localStorage.getItem(AVATAR_KEY));
  const [email, setEmail] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [meetingNote, setMeetingNote] = useState<string>(() => localStorage.getItem(MEETING_NOTE_KEY) || '');
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user;
      if (!u) return;
      setEmail(u.email || '');
      setName((u.user_metadata as any)?.full_name || (u.user_metadata as any)?.name || (u.email?.split('@')[0] || ''));
      const remoteAvatar = (u.user_metadata as any)?.avatar_url;
      if (remoteAvatar && !localStorage.getItem(AVATAR_KEY)) setAvatar(remoteAvatar);
    });
  }, []);

  // On mount, push persisted status into the softphone so SIP state matches restored UI.
  useEffect(() => {
    const saved = (localStorage.getItem(STATUS_KEY) as Status) || 'available';
    const dispatch = () => window.dispatchEvent(
      new CustomEvent('lemtel:set-status', { detail: STATUS_META[saved].manual })
    );
    dispatch();
    const t = setTimeout(dispatch, 1500); // re-apply after useSoftphone mounts
    return () => clearTimeout(t);
  }, []);

  // Listen to global shortcuts / tray status changes from the main process
  useEffect(() => {
    const cb = (s: any) => {
      if (STATUS_META[s as Status]) {
        applyStatus(s as Status);
      }
    };
    window.electronAPI?.onSetUiStatus?.(cb);
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const meta = STATUS_META[status];
  const initials = (name || email || '?').slice(0, 2).toUpperCase();

  const applyStatus = (s: Status) => {
    setStatus(s);
    localStorage.setItem(STATUS_KEY, s);
    window.dispatchEvent(new CustomEvent('lemtel:set-status', { detail: STATUS_META[s].manual }));
    if (s !== 'meeting') setOpen(false);
  };

  const saveMeetingNote = (v: string) => {
    setMeetingNote(v);
    try { localStorage.setItem(MEETING_NOTE_KEY, v); } catch { /* noop */ }
  };


  const openSettings = () => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent('lemtel:nav', { detail: 'settings' }));
  };

  const signOut = async () => {
    setOpen(false);
    try { setAuthToken(null); } catch { /* noop */ }
    try { await supabase.auth.signOut(); } catch { /* noop */ }
    try {
      window.localStorage.removeItem('lemtel-desktop-auth');
      window.sessionStorage.removeItem('lemtel-desktop-auth');
    } catch { /* noop */ }
    await (window as any).electronAPI?.clearCredentials?.();
    window.location.reload();
  };

  const onPickPhoto = () => fileRef.current?.click();

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) { alert('Image must be under 2 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || '');
      setAvatar(url);
      try { localStorage.setItem(AVATAR_KEY, url); } catch { /* noop */ }
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setAvatar(null);
    try { localStorage.removeItem(AVATAR_KEY); } catch { /* noop */ }
  };

  return (
    <div ref={rootRef} style={{ position: 'relative', WebkitAppRegion: 'no-drag' as any }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={`${name || email} · ${meta.label}`}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '3px 10px 3px 3px', borderRadius: 999,
          background: 'rgba(8,16,38,0.6)',
          border: `1px solid ${c.border}`,
          color: '#d8e6ff', cursor: 'pointer',
        }}
      >
        <span style={{
          position: 'relative', width: 26, height: 26, borderRadius: '50%',
          overflow: 'hidden', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #0023e6, #7a4cff)',
          color: '#fff', fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
        }}>
          {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
          <span style={{
            position: 'absolute', right: -1, bottom: -1, width: 9, height: 9, borderRadius: '50%',
            background: meta.color, border: '2px solid #0a1530',
          }} />
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {status === 'meeting' && meetingNote ? `Meeting · ${meetingNote}` : meta.label}
        </span>
        <span style={{ fontSize: 9, opacity: 0.6 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 38, right: 0, width: 260,
          background: 'rgba(10,21,48,0.98)',
          border: `1px solid ${c.border}`, borderRadius: 12,
          boxShadow: '0 18px 48px -16px rgba(0,0,0,0.7)',
          padding: 10, zIndex: 200, backdropFilter: 'blur(14px)',
        }}>
          {/* Profile header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 6px 10px', borderBottom: `1px solid ${c.border}` }}>
            <button onClick={onPickPhoto} title="Change photo" style={{
              position: 'relative', width: 44, height: 44, borderRadius: '50%', overflow: 'hidden',
              border: `1px solid ${c.border}`, padding: 0, cursor: 'pointer',
              background: 'linear-gradient(135deg, #0023e6, #7a4cff)',
              color: '#fff', fontSize: 14, fontWeight: 800,
            }}>
              {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: '#fff', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || 'Account'}</div>
              <div style={{ fontSize: 10, color: c.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <button onClick={onPickPhoto} style={miniBtn}>Change photo</button>
                {avatar && <button onClick={removePhoto} style={miniBtn}>Remove</button>}
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPhotoChange} style={{ display: 'none' }} />
          </div>

          {/* Status */}
          <div style={{ padding: '8px 4px 4px', fontSize: 9, fontWeight: 800, color: c.textSub, letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Set status
          </div>
          {(Object.keys(STATUS_META) as Status[]).map((s) => {
            const m = STATUS_META[s];
            const active = s === status;
            return (
              <button key={s} onClick={() => applyStatus(s)} style={menuItem(active)}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, boxShadow: `0 0 8px ${m.color}` }} />
                <span style={{ flex: 1, textAlign: 'left' }}>{m.label}</span>
                {active && <span style={{ fontSize: 11, color: m.color }}>✓</span>}
              </button>
            );
          })}

          {status === 'meeting' && (
            <div style={{ padding: '8px 6px 4px' }}>
              <input
                type="text"
                value={meetingNote}
                onChange={(e) => saveMeetingNote(e.target.value)}
                placeholder="Meeting note (e.g. Standup until 3pm)"
                maxLength={80}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.05)', color: '#fff',
                  border: `1px solid ${c.border}`, borderRadius: 8,
                  padding: '7px 9px', fontSize: 11, outline: 'none',
                }}
              />
            </div>
          )}

          <div style={{ height: 1, background: c.border, margin: '8px 0' }} />


          <button onClick={openSettings} style={menuItem(false)}>
            <span aria-hidden>⚙</span>
            <span style={{ flex: 1, textAlign: 'left' }}>Settings</span>
          </button>
          <button onClick={signOut} style={{ ...menuItem(false), color: '#ef4444' }}>
            <span aria-hidden>⎋</span>
            <span style={{ flex: 1, textAlign: 'left' }}>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}

const miniBtn: React.CSSProperties = {
  fontSize: 9, padding: '3px 7px', borderRadius: 6,
  background: 'rgba(255,255,255,0.06)', border: `1px solid ${c.border}`,
  color: '#d8e6ff', cursor: 'pointer', letterSpacing: 0.4,
};

function menuItem(active: boolean): React.CSSProperties {
  return {
    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 10px', borderRadius: 8,
    background: active ? 'rgba(0,35,230,0.18)' : 'transparent',
    border: '1px solid transparent',
    color: '#e8efff', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', textAlign: 'left',
  };
}
