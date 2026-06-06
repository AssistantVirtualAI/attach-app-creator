import React, { useState } from 'react';
import { Empty } from './RecentsScreen';

export default function ContactsScreen({ sp }: { sp: any }) {
  const [q, setQ] = useState('');
  const contacts: any[] = sp.snap.contacts || [];
  const filtered = contacts.filter((c) =>
    !q || (c.name || '').toLowerCase().includes(q.toLowerCase()) || (c.number || '').includes(q),
  );

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '20px 16px' }}>
      <h2 style={{ fontSize: 28, fontWeight: 700, margin: '8px 0 16px' }}>Contacts</h2>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search"
        style={{
          width: '100%', height: 40, padding: '0 14px', borderRadius: 10,
          background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
          color: 'white', fontSize: 14, outline: 'none', marginBottom: 12,
        }}
      />
      {filtered.length === 0 ? (
        <Empty label="No contacts" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filtered.map((c, i) => (
            <button key={i} onClick={() => sp.call(c.number)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border)', color: 'white', cursor: 'pointer',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontSize: 15 }}>{c.name}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.number}</span>
              </div>
              <span style={{ fontSize: 16, color: 'var(--brand-blue-2)' }}>☏</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
