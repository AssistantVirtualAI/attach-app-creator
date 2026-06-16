import React, { useEffect, useRef, useState } from 'react';
import { theme } from '../lib/theme';
import { supabase } from '../lib/supabaseClient';
import { setAuthToken } from '../lib/avaApi';
import { useCallBus } from '../hooks/useCallBus';


const { colors: c } = theme;

type Status =
  | 'available'
  | 'busy'
  | 'meeting'
  | 'dnd'
  | 'lunch'
  | 'break'
  | 'training'
  | 'travel'
  | 'vacation'
  | 'sick'
  | 'remote'
  | 'away';

const STATUS_META: Record<Status, { label: string; icon: string; color: string; manual: 'available' | 'dnd' | 'away' }> = {
  available: { label: 'Available',         icon: '🟢', color: '#22c55e', manual: 'available' },
  busy:      { label: 'Busy',              icon: '🔴', color: '#ef4444', manual: 'dnd' },
  meeting:   { label: 'In a meeting',      icon: '📅', color: '#f59e0b', manual: 'dnd' },
  dnd:       { label: 'Do not disturb',    icon: '⛔', color: '#dc2626', manual: 'dnd' },
  lunch:     { label: 'Lunch break',       icon: '🍽️', color: '#fb923c', manual: 'away' },
  break:     { label: 'On a break',        icon: '☕', color: '#a78bfa', manual: 'away' },
  training:  { label: 'Training',          icon: '🎓', color: '#38bdf8', manual: 'dnd' },
  travel:    { label: 'On travel',         icon: '✈️', color: '#06b6d4', manual: 'away' },
  vacation:  { label: 'On vacation',       icon: '🏖️', color: '#0ea5e9', manual: 'away' },
  sick:      { label: 'Sick leave',        icon: '🤒', color: '#f43f5e', manual: 'away' },
  remote:    { label: 'Working remotely',  icon: '🏠', color: '#8b5cf6', manual: 'available' },
  away:      { label: 'Not available',     icon: '⚪', color: '#94a3b8', manual: 'away' },
};

const AVATAR_KEY = 'lemtel:user-avatar';
const STATUS_KEY = 'lemtel:user-status';

const MEETING_NOTE_KEY = 'lemtel:meeting-note';

export default function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>(() => {
    const s = localStorage.getItem(STATUS_KEY) as Status;
    return s && STATUS_META[s] ? s : 'available';
  });
  const [avatar, setAvatar] = useState<string | null>(() => localStorage.getItem(AVATAR_KEY));
  const [email, setEmail] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [meetingNote, setMeetingNote] = useState<string>(() => localStorage.getItem(MEETING_NOTE_KEY) || '');
  const [lockMsg, setLockMsg] = useState<string>('');
  const [profileOpen, setProfileOpen] = useState(false);
  const { call } = useCallBus();
  const inCall = !!call && call.status !== 'ended' && call.status !== 'idle';
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const meetingInputRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<Status>(status);
  const openRef = useRef<boolean>(open);
  const inCallRef = useRef<boolean>(inCall);
  statusRef.current = status;
  openRef.current = open;
  inCallRef.current = inCall;


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
    const meta = STATUS_META[saved] || STATUS_META.available;
    const dispatch = () => window.dispatchEvent(
      new CustomEvent('lemtel:set-status', { detail: meta.manual })
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

  // Global shortcut: focus / toggle meeting note field
  useEffect(() => {
    const cb = () => {
      if (statusRef.current !== 'meeting') {
        applyStatus('meeting');
      }
      setTimeout(() => {
        if (openRef.current && meetingInputRef.current === document.activeElement) {
          setOpen(false);
        } else {
          setOpen(true);
          meetingInputRef.current?.focus();
          meetingInputRef.current?.select();
        }
      }, 10);
    };
    window.electronAPI?.onFocusMeetingNote?.(cb);
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
    if (inCallRef.current) {
      const msg = "Vous êtes en appel — votre statut est verrouillé jusqu'à la fin de l'appel.";
      setLockMsg(msg);
      setOpen(true);
      try { window.electronAPI?.showNotification?.('Statut verrouillé', msg, { tag: 'lemtel-status-lock' }); } catch { /* noop */ }
      setTimeout(() => setLockMsg(''), 4000);
      return;
    }
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
    reader.onload = async () => {
      const url = String(reader.result || '');
      setAvatar(url);
      try { localStorage.setItem(AVATAR_KEY, url); } catch { /* noop */ }
      try { await supabase.auth.updateUser({ data: { avatar_url: url } }); } catch { /* noop */ }
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = async () => {
    setAvatar(null);
    try { localStorage.removeItem(AVATAR_KEY); } catch { /* noop */ }
    try { await supabase.auth.updateUser({ data: { avatar_url: null } }); } catch { /* noop */ }
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
        <span
          onClick={(e) => { e.stopPropagation(); onPickPhoto(); }}
          title="Change photo"
          style={{
            position: 'relative', width: 26, height: 26, borderRadius: '50%',
            overflow: 'hidden', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #0023e6, #7a4cff)',
            color: '#fff', fontSize: 10, fontWeight: 800, letterSpacing: 0.5, cursor: 'pointer',
          }}
        >
          {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
          <span style={{
            position: 'absolute', right: -1, bottom: -1, width: 9, height: 9, borderRadius: '50%',
            background: meta.color, border: '2px solid #ffffff',
          }} />
        </span>
        <span
          onClick={(e) => { e.stopPropagation(); setProfileOpen(true); setOpen(false); }}
          title="Edit profile"
          style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
        >
          {status === 'meeting' && meetingNote ? `Meeting · ${meetingNote}` : `${meta.icon} ${meta.label}`}
        </span>
        <span style={{ fontSize: 9, opacity: 0.6 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 38, right: 0, width: 280,
          background: '#ffffff',
          border: `1px solid ${c.border}`, borderRadius: 12,
          boxShadow: '0 18px 48px -16px rgba(0,0,0,0.7)',
          padding: 10, zIndex: 200, backdropFilter: 'blur(14px)',
          maxHeight: '78vh', overflowY: 'auto',
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
              <button onClick={() => { setProfileOpen(true); setOpen(false); }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                <div style={{ fontSize: 12, color: '#0f172a', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || 'Account'}</div>
                <div style={{ fontSize: 10, color: c.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
              </button>
              <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                <button onClick={onPickPhoto} style={miniBtn}>Change photo</button>
                {avatar && <button onClick={removePhoto} style={miniBtn}>Remove</button>}
                <button onClick={() => { setProfileOpen(true); setOpen(false); }} style={miniBtn}>Edit profile</button>
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPhotoChange} style={{ display: 'none' }} />
          </div>

          {/* Status */}
          <div style={{ padding: '8px 4px 4px', fontSize: 9, fontWeight: 800, color: c.textSub, letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Set status
          </div>
          {inCall && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              margin: '4px 2px 6px', padding: '7px 9px', borderRadius: 8,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)',
              color: '#b91c1c', fontSize: 10.5, lineHeight: 1.35,
            }}>
              <span aria-hidden style={{ fontSize: 13 }}>🔒</span>
              <span>Statut verrouillé pendant un appel actif. Terminez l'appel pour le modifier.</span>
            </div>
          )}
          {lockMsg && !inCall && (
            <div style={{
              margin: '4px 2px 6px', padding: '7px 9px', borderRadius: 8,
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.4)',
              color: '#92400e', fontSize: 10.5,
            }}>{lockMsg}</div>
          )}
          {(Object.keys(STATUS_META) as Status[]).map((s) => {
            const m = STATUS_META[s];
            const active = s === status;
            return (
              <button
                key={s}
                onClick={() => applyStatus(s)}
                disabled={inCall}
                title={inCall ? "Indisponible pendant un appel actif" : ''}
                style={{ ...menuItem(active), opacity: inCall ? 0.5 : 1, cursor: inCall ? 'not-allowed' : 'pointer' }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, boxShadow: `0 0 8px ${m.color}` }} />
                <span aria-hidden style={{ fontSize: 13, width: 18, textAlign: 'center' }}>{m.icon}</span>
                <span style={{ flex: 1, textAlign: 'left' }}>{m.label}</span>
                {active && <span style={{ fontSize: 11, color: m.color }}>✓</span>}
              </button>
            );
          })}


          {status === 'meeting' && (
            <div style={{ padding: '8px 6px 4px' }}>
              <input
                ref={meetingInputRef}
                type="text"
                value={meetingNote}
                onChange={(e) => saveMeetingNote(e.target.value)}
                placeholder="Meeting note (e.g. Standup until 3pm)"
                maxLength={80}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(15,23,42,0.05)', color: '#0f172a',
                  border: `1px solid ${c.border}`, borderRadius: 8,
                  padding: '7px 9px', fontSize: 11, outline: 'none',
                }}
              />
            </div>
          )}

          <div style={{ height: 1, background: c.border, margin: '8px 0' }} />


          <button onClick={() => { setProfileOpen(true); setOpen(false); }} style={menuItem(false)}>
            <span aria-hidden>👤</span>
            <span style={{ flex: 1, textAlign: 'left' }}>Manage profile</span>
          </button>
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

      {profileOpen && (
        <ProfileEditor
          name={name}
          email={email}
          avatar={avatar}
          onClose={() => setProfileOpen(false)}
          onSaved={(newName, newAvatar) => { setName(newName); if (newAvatar !== undefined) setAvatar(newAvatar); }}
          onPickPhoto={onPickPhoto}
          onRemovePhoto={removePhoto}
        />
      )}
    </div>
  );
}

function ProfileEditor({
  name: initialName, email, avatar, onClose, onSaved, onPickPhoto, onRemovePhoto,
}: {
  name: string; email: string; avatar: string | null;
  onClose: () => void;
  onSaved: (name: string, avatar?: string | null) => void;
  onPickPhoto: () => void;
  onRemovePhoto: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const initials = (initialName || email || '?').slice(0, 2).toUpperCase();

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: name, name } });
      if (error) throw error;
      onSaved(name);
      setMsg({ kind: 'ok', text: 'Profile updated.' });
    } catch (e: any) {
      setMsg({ kind: 'err', text: e?.message || 'Failed to update profile.' });
    } finally { setSaving(false); }
  };

  const changePassword = async () => {
    if (pw1.length < 8) { setMsg({ kind: 'err', text: 'Password must be at least 8 characters.' }); return; }
    if (pw1 !== pw2) { setMsg({ kind: 'err', text: 'Passwords do not match.' }); return; }
    setSaving(true); setMsg(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;
      setPw1(''); setPw2('');
      setMsg({ kind: 'ok', text: 'Password updated successfully.' });
    } catch (e: any) {
      setMsg({ kind: 'err', text: e?.message || 'Failed to update password.' });
    } finally { setSaving(false); }
  };

  const sendResetEmail = async () => {
    if (!email) return;
    setSaving(true); setMsg(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setMsg({ kind: 'ok', text: `Reset link sent to ${email}.` });
    } catch (e: any) {
      setMsg({ kind: 'err', text: e?.message || 'Failed to send reset email.' });
    } finally { setSaving(false); }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.65)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(440px, 92vw)', maxHeight: '88vh', overflowY: 'auto',
          background: '#ffffff', border: `1px solid ${c.border}`, borderRadius: 14,
          boxShadow: '0 24px 60px -12px rgba(0,0,0,0.55)', padding: 18,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Manage profile</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#64748b' }}>×</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <button onClick={onPickPhoto} style={{
            width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', border: `1px solid ${c.border}`,
            padding: 0, cursor: 'pointer', background: 'linear-gradient(135deg, #0023e6, #7a4cff)',
            color: '#fff', fontSize: 20, fontWeight: 800,
          }}>
            {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={onPickPhoto} style={primaryBtn}>Upload new photo</button>
            {avatar && <button onClick={onRemovePhoto} style={ghostBtn}>Remove photo</button>}
          </div>
        </div>

        <label style={lbl}>Full name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={input} />

        <label style={lbl}>Email</label>
        <input value={email} readOnly style={{ ...input, opacity: 0.7 }} />

        <button onClick={save} disabled={saving} style={{ ...primaryBtn, width: '100%', marginTop: 10 }}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>

        <div style={{ height: 1, background: c.border, margin: '18px 0' }} />

        <div style={{ fontSize: 11, fontWeight: 800, color: c.textSub, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 }}>
          Password
        </div>
        <label style={lbl}>New password</label>
        <input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder="At least 8 characters" style={input} />
        <label style={lbl}>Confirm password</label>
        <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} style={input} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={changePassword} disabled={saving} style={{ ...primaryBtn, flex: 1 }}>Update password</button>
          <button onClick={sendResetEmail} disabled={saving} style={{ ...ghostBtn, flex: 1 }}>Email reset link</button>
        </div>

        {msg && (
          <div style={{
            marginTop: 14, padding: '8px 10px', borderRadius: 8, fontSize: 11.5,
            background: msg.kind === 'ok' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${msg.kind === 'ok' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
            color: msg.kind === 'ok' ? '#15803d' : '#b91c1c',
          }}>{msg.text}</div>
        )}
      </div>
    </div>
  );
}

const miniBtn: React.CSSProperties = {
  fontSize: 9, padding: '3px 7px', borderRadius: 6,
  background: 'rgba(15,23,42,0.06)', border: `1px solid ${c.border}`,
  color: '#0f172a', cursor: 'pointer', letterSpacing: 0.4,
};

const lbl: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 700, color: '#475569',
  textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 10, marginBottom: 4,
};

const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: '#f8fafc', color: '#0f172a',
  border: `1px solid ${c.border}`, borderRadius: 8,
  padding: '9px 11px', fontSize: 12, outline: 'none',
};

const primaryBtn: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 8, border: 'none',
  background: 'linear-gradient(135deg, #0023e6, #4d82ff)',
  color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
};

const ghostBtn: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 8,
  background: 'transparent', border: `1px solid ${c.border}`,
  color: '#0f172a', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
};

function menuItem(active: boolean): React.CSSProperties {
  return {
    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 10px', borderRadius: 8,
    background: active ? 'rgba(0,35,230,0.12)' : 'transparent',
    border: '1px solid transparent',
    color: '#0f172a', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', textAlign: 'left',
  };
}
