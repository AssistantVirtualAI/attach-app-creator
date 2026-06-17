import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { theme } from '../lib/theme';

const { colors: c } = theme;

export default function CallForwarding({ extension }: { extension: string }) {
  const [enabled, setEnabled] = useState(false);
  const [target, setTarget] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('pbx_softphone_users')
        .select('forward_enabled, forward_to')
        .eq('extension', extension)
        .maybeSingle();
      if (data) {
        setEnabled(!!(data as any).forward_enabled);
        setTarget((data as any).forward_to || '');
      }
    })();
  }, [extension]);

  const save = async (next: { enabled?: boolean; target?: string }) => {
    setSaving(true);
    const payload: any = {};
    if (next.enabled !== undefined) payload.forward_enabled = next.enabled;
    if (next.target !== undefined) payload.forward_to = next.target;
    await supabase.from('pbx_softphone_users').update(payload).eq('extension', extension);
    setSaving(false);
  };

  return (
    <div style={{ marginBottom: 12, background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 8, padding: 10, minWidth: 0 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ background: 'none', border: 'none', color: c.text, fontSize: 11, fontWeight: 800, cursor: 'pointer', width: '100%', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        ↪ Call forwarding {enabled ? `· → ${target || '(unset)'}` : '· off'} {open ? '▾' : '▸'}
      </button>
      {open && (
        <div style={{ marginTop: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, marginBottom: 8, color: c.text }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => { setEnabled(e.target.checked); save({ enabled: e.target.checked }); }}
              disabled={saving}
            />
            Forward all calls
          </label>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onBlur={() => save({ target })}
            placeholder="Extension or external number"
            style={{
              width: '100%', padding: 8, fontSize: 12, borderRadius: 6,
              background: c.bgElev, color: c.text,
              border: `1px solid ${c.border}`, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
      )}
    </div>
  );
}
