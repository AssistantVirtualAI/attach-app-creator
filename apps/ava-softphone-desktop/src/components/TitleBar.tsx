import React from 'react';
import LemtelLogo from './LemtelLogo';
import ProfileMenu from './ProfileMenu';
import { theme } from '../lib/theme';

const dragStyle: React.CSSProperties = {
  // @ts-expect-error electron CSS
  WebkitAppRegion: 'drag',
};

interface Props {
  sipStatus?: string;
}

export default function TitleBar(_props: Props = {}) {
  const { colors } = theme;

  return (
    <div
      style={{
        height: 42,
        background: 'rgba(10,21,48,0.85)',
        borderBottom: `1px solid ${colors.border}`,
        color: colors.text,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 14px',
        position: 'relative',
        backdropFilter: 'blur(14px)',
        ...dragStyle,
      }}
    >
      {/* Left: window controls spacer (macOS traffic lights) */}
      <div style={{ width: 70 }} />

      {/* Center: empty (status pills removed) */}
      <div />

      {/* Right: profile menu */}
      <ProfileMenu />
    </div>
  );
}

export { LemtelLogo };
