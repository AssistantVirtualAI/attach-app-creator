import React from 'react';
import {
  Home, Phone, MessageCircle, Sparkles, Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react';
import { colors, gradients, radius } from '../lib/theme';

export type Tab =
  | 'home' | 'calls' | 'ava' | 'messages' | 'settings'
  // legacy routes still reachable via deep-link / query param:
  | 'more' | 'voicemail' | 'contacts' | 'sms' | 'queues';


type Item = { id: Tab; label: string; Icon: LucideIcon };

const LEFT: Item[] = [
  { id: 'home',  label: 'Home',  Icon: Home },
  { id: 'calls', label: 'Calls', Icon: Phone },
];
const RIGHT: Item[] = [
  { id: 'messages', label: 'Messages', Icon: MessageCircle },
  { id: 'settings', label: 'Settings', Icon: SettingsIcon },
];

export default function BottomTabs({
  active, onChange, badges,
}: { active: Tab; onChange: (t: Tab) => void; badges?: Partial<Record<Tab, number>> }) {
  return (
    <nav
      style={{
        position: 'relative',
        display: 'flex', flexDirection: 'column',
        margin: '0 10px calc(10px + var(--safe-bottom))',
        padding: '10px 8px 8px',
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(244,247,255,0.86) 100%)',
        backdropFilter: 'blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.9)',
        borderRadius: radius.xxl,
        boxShadow:
          '0 24px 60px -28px rgba(7,22,168,0.35), 0 1px 0 rgba(255,255,255,0.9) inset, 0 -1px 0 rgba(0,35,230,0.05) inset',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 78px 1fr 1fr',
          alignItems: 'center',
        }}
      >
        {LEFT.map((it) => (
          <TabBtn key={it.id} item={it} active={active === it.id} onPress={() => onChange(it.id)} badge={badges?.[it.id]} />
        ))}

        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => onChange('ava')}
            aria-label="AVA assistant"
            style={{
              position: 'absolute', top: -34, width: 62, height: 62,
              borderRadius: '50%', background: gradients.ai,
              border: '3px solid rgba(255,255,255,0.96)',
              boxShadow:
                '0 18px 38px -12px rgba(122,76,255,0.6), 0 0 0 6px rgba(122,76,255,0.08), 0 0 24px rgba(106,225,255,0.35) inset',
              color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center',
              transform: active === 'ava' ? 'scale(1.08) translateY(-2px)' : 'scale(1)',
              transition: 'transform .25s cubic-bezier(.34,1.56,.64,1)',
            }}
          >
            <Sparkles size={26} strokeWidth={2.4} />
          </button>
          <span
            style={{
              position: 'absolute', top: 36, fontSize: 9.5, fontWeight: 800, letterSpacing: 1.4,
              color: active === 'ava' ? colors.avaViolet : colors.mutedSilver,
            }}
          >
            AVA
          </span>
        </div>

        {RIGHT.map((it) => (
          <TabBtn key={it.id} item={it} active={active === it.id} onPress={() => onChange(it.id)} badge={badges?.[it.id]} />
        ))}
      </div>
    </nav>
  );
}

function TabBtn({ item, active, onPress, badge }: { item: Item; active: boolean; onPress: () => void; badge?: number }) {
  const { Icon, label } = item;
  const accent = colors.lemtelBlue;
  return (
    <button
      onClick={onPress}
      style={{
        position: 'relative', minHeight: 50, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 3, padding: '6px 2px',
        borderRadius: radius.lg,
        background: active
          ? `linear-gradient(180deg, ${accent}22 0%, rgba(255,255,255,0.4) 100%)`
          : 'transparent',
        border: active ? `1px solid ${accent}33` : '1px solid transparent',
        boxShadow: active
          ? `0 8px 20px -10px ${accent}66, 0 1px 0 rgba(255,255,255,0.9) inset`
          : 'none',
        color: active ? accent : colors.mutedSilver,
        cursor: 'pointer',
        transition: 'all .22s cubic-bezier(.34,1.56,.64,1)',
        transform: active ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      <span
        style={{
          position: 'relative',
          display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 10,
          background: active
            ? `radial-gradient(circle at 30% 30%, ${accent}33, ${accent}11 70%)`
            : 'transparent',
        }}
      >
        <Icon size={18} strokeWidth={active ? 2.6 : 2} />
        {badge && badge > 0 ? (
          <span
            aria-label={`${badge} new`}
            style={{
              position: 'absolute', top: -4, right: -6,
              minWidth: 16, height: 16, padding: '0 4px',
              borderRadius: 8, background: '#ff3b30',
              color: '#fff', fontSize: 10, fontWeight: 800,
              display: 'grid', placeItems: 'center',
              boxShadow: '0 2px 6px rgba(255,59,48,0.45), 0 0 0 2px #fff',
              lineHeight: 1,
            }}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
      </span>
      <span style={{ fontSize: 9.5, fontWeight: active ? 800 : 600, letterSpacing: 0.3 }}>
        {label}
      </span>
    </button>
  );
}
