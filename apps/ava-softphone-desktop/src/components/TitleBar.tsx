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
        background: colors.deepPanel,
        borderBottom: `1px solid ${colors.border}`,
        color: colors.text,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 14px',
        position: 'relative',
        zIndex: 1000,
        overflow: 'visible',
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
