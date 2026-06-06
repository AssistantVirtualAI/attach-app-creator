/**
 * Lemtel AI Phone — Mobile design tokens.
 * Premium dark UI: luminous Lemtel blue + signal gold + AVA cyan/violet.
 */
export const colors = {
  midnight:   '#050816',
  midnight2:  '#0A0F23',
  graphite:   '#101727',
  graphite2:  '#172033',
  lemtelBlue: '#0716A8',
  blueGlow:   '#2D55E5',
  signalGold: '#FFE600',
  goldSoft:   '#F0C75A',
  avaCyan:    '#23D6FF',
  avaViolet:  '#7A4CFF',
  textIce:    '#F6F8FF',
  textSub:    '#C2CCE4',
  mutedSilver:'#A9B4C7',
  border:     'rgba(140,180,255,0.10)',
  borderGold: 'rgba(255,230,0,0.32)',
  borderAI:   'rgba(122,76,255,0.40)',
  danger:     '#FF4D67',
  success:    '#28E6A5',
  warning:    '#FFCC33',
} as const;

export const gradients = {
  app:    `radial-gradient(1200px 700px at 8% -10%, rgba(7,22,168,0.32), transparent 60%), radial-gradient(900px 600px at 100% 110%, rgba(255,230,0,0.10), transparent 55%), linear-gradient(180deg, ${colors.midnight} 0%, #07112E 100%)`,
  call:   `linear-gradient(135deg, ${colors.lemtelBlue} 0%, ${colors.blueGlow} 50%, ${colors.signalGold} 130%)`,
  ai:     `linear-gradient(135deg, ${colors.avaViolet}, ${colors.avaCyan})`,
  card:   `linear-gradient(155deg, rgba(23,32,51,0.92) 0%, rgba(16,23,39,0.92) 100%)`,
  hero:   `linear-gradient(160deg, rgba(7,22,168,0.55) 0%, rgba(45,85,229,0.20) 45%, transparent 100%)`,
} as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;
export const space  = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 40 } as const;

export const font = {
  family: `'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif`,
  mono:   `'JetBrains Mono', 'SF Mono', ui-monospace, monospace`,
  xs: 10, sm: 11, base: 13, md: 15, lg: 18, xl: 22, xxl: 28, display: 34,
} as const;

export const shadow = {
  card: '0 12px 32px -18px rgba(0,0,0,0.55)',
  lift: '0 18px 40px -22px rgba(7,22,168,0.55)',
  gold: '0 14px 36px -16px rgba(255,230,0,0.45)',
  ai:   '0 14px 36px -16px rgba(122,76,255,0.55)',
} as const;
