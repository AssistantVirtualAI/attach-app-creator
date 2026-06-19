import React from 'react';
import { Phone, Mic, Voicemail, Sparkles, Users, MessageSquare, MoreHorizontal, type LucideIcon } from 'lucide-react';
import { colors, gradients, radius } from '../lib/theme';

export type Tab =
  | 'home'
  | 'calls'
  | 'recordings'
  | 'voicemail'
  | 'ava'
  | 'contacts'
  | 'messages'
  | 'more';

type Item = { id: Tab; label: string; Icon: LucideIcon };

const SIDE_LEFT: Item[] = [
  { id: 'calls',      label: 'Calls',      Icon: Phone },
  { id: 'recordings', label: 'Recordings', Icon: Mic },
  { id: 'voicemail',  label: 'Voicemail',  Icon: Voicemail },
];
const SIDE_RIGHT: Item[] = [
  { id: 'contacts', label: 'Contacts', Icon: Users },
  { id: 'messages', label: 'Messages', Icon: MessageSquare },
  { id: 'more',     label: 'More',     Icon: MoreHorizontal },
];

export default function BottomTabs({
  active, onChange,
}: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr) 76px repeat(3, 1fr)',
        alignItems: 'center',
        margin: '0 8px calc(8px + var(--safe-bottom))',
        padding: '8px 6px',
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
      {SIDE_LEFT.map((it) => (
        <TabBtn key={it.id} item={it} active={active === it.id} onPress={() => onChange(it.id)} />
      ))}

      {/* Floating AVA orb */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={() => onChange('ava')}
          aria-label="AVA assistant"
          style={{
            position: 'absolute',
            top: -32,
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: gradients.ai,
            border: '3px solid rgba(255,255,255,0.96)',
            boxShadow:
              '0 18px 38px -12px rgba(122,76,255,0.6), 0 0 0 6px rgba(122,76,255,0.08), 0 0 24px rgba(106,225,255,0.35) inset',
            color: '#fff',
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            transform: active === 'ava' ? 'scale(1.08) translateY(-2px)' : 'scale(1)',
            transition: 'transform .25s cubic-bezier(.34,1.56,.64,1), box-shadow .25s ease',
          }}
        >
          <Sparkles size={24} strokeWidth={2.4} />
        </button>
        <span
          style={{
            position: 'absolute',
            top: 34,
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: 1.2,
            color: active === 'ava' ? colors.avaViolet : colors.mutedSilver,
            transition: 'color .2s ease',
          }}
        >
          AVA
        </span>
      </div>

      {SIDE_RIGHT.map((it) => (
        <TabBtn key={it.id} item={it} active={active === it.id} onPress={() => onChange(it.id)} />
      ))}
    </nav>
  );
}

function TabBtn({ item, active, onPress }: { item: Item; active: boolean; onPress: () => void }) {
  const { Icon, label } = item;
  const accent = colors.lemtelBlue;
  return (
    <button
      onClick={onPress}
      style={{
        position: 'relative',
        minHeight: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        padding: '6px 2px',
        borderRadius: radius.xl,
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
          display: 'grid',
          placeItems: 'center',
          width: 28,
          height: 28,
          borderRadius: 10,
          background: active
            ? `radial-gradient(circle at 30% 30%, ${accent}33, ${accent}11 70%)`
            : 'transparent',
          transition: 'background .22s ease',
        }}
      >
        <Icon size={18} strokeWidth={active ? 2.6 : 2} />
      </span>
      <span style={{ fontSize: 9, fontWeight: active ? 800 : 600, letterSpacing: 0.3, whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {active && (
        <span
          style={{
            position: 'absolute',
            bottom: 2,
            width: 14,
            height: 2,
            borderRadius: 2,
            background: `linear-gradient(90deg, ${accent}, ${colors.avaCyan})`,
            boxShadow: `0 0 8px ${accent}88`,
          }}
        />
      )}
    </button>
  );
}
