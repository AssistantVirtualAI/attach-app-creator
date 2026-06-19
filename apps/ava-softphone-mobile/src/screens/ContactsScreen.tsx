import React, { useEffect, useMemo, useState } from 'react';
import { colors, font, radius } from '../lib/theme';
import { Card, EmptyState, SectionTitle } from '../components/ui/Primitives';
import { loadCachedContacts, syncDeviceContacts, searchContacts, type DeviceContact } from '../lib/contacts';
import { Phone, RefreshCw } from 'lucide-react';

export default function ContactsScreen({ sp }: { sp: any }) {
  const [q, setQ] = useState('');
  const [contacts, setContacts] = useState<DeviceContact[]>(() => loadCachedContacts());
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);

  const refresh = async () => {
    setSyncing(true);
    try {
      const next = await syncDeviceContacts();
      setContacts(next.length ? next : loadCachedContacts());
      setSyncedAt(Date.now());
    } finally { setSyncing(false); }
  };

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    document.addEventListener('visibilitychange', onFocus);
    return () => document.removeEventListener('visibilitychange', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => searchContacts(q, contacts), [q, contacts]);

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '14px 14px 80px' }}>
      <SectionTitle eyebrow="Directory" title="Contacts" />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 2px 10px' }}>
        <span style={{ fontSize: font.xs, color: colors.mutedSilver }}>
          {syncedAt ? `Synced ${new Date(syncedAt).toLocaleTimeString()}` : 'Syncing…'} · {contacts.length} contacts
        </span>
        <button onClick={refresh} disabled={syncing} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 999, border: `1px solid ${colors.border}`,
          background: 'rgba(255,255,255,0.7)', color: colors.lemtelBlue,
          fontSize: 11, fontWeight: 800, letterSpacing: 0.6, cursor: 'pointer',
        }}>
          <RefreshCw size={12} /> {syncing ? 'Syncing…' : 'Refresh'}
        </button>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name or number"
        style={{
          width: '100%', height: 42, padding: '0 14px', borderRadius: radius.lg,
          background: 'rgba(255,255,255,0.85)', border: `1px solid ${colors.border}`,
          color: colors.textIce, fontSize: 14, outline: 'none', marginBottom: 12,
        }}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No contacts found"
          hint={contacts.length === 0
            ? 'Allow contacts access to populate your dialer.'
            : 'Try a different search term.'}
        />
      ) : (
        filtered.map((c) => (
          <Card key={c.id} style={{ marginBottom: 6 }} padded={true}
            onPress={() => sp.call(c.numbers[0])}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: font.base, fontWeight: 700, color: colors.textIce, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.name}
                </div>
                <div style={{ fontSize: font.xs, color: colors.mutedSilver, marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
                  {c.numbers[0]}{c.numbers.length > 1 ? ` · +${c.numbers.length - 1}` : ''}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); sp.call(c.numbers[0]); }}
                aria-label={`Call ${c.name}`}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${colors.lemtelBlue}, ${colors.avaCyan})`,
                  border: 'none', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer',
                }}
              >
                <Phone size={16} />
              </button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
