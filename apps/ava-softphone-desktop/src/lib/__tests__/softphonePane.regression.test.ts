import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * Static regression checks for SoftphonePane.
 *
 * 1. Dark-mode visibility: ControlBtn (Hold, Mute, Transfer, Record, Keypad,
 *    Attended) MUST use theme-aware surface/border/text tokens. Hard-coded
 *    white backgrounds caused white-on-white invisible labels in dark mode.
 *
 * 2. Wide-mode dialer freeze: the keypad MUST be memoized and its handlers
 *    MUST be wrapped in useCallback so keystrokes don't trigger a full
 *    re-render of the heavy SoftphonePane subtree.
 */

const SRC = readFileSync(
  path.resolve(__dirname, '../../components/SoftphonePane.tsx'),
  'utf8',
);

describe('SoftphonePane — dark-mode ControlBtn visibility', () => {
  // Isolate the ControlBtn definition so we don't accidentally match unrelated styles.
  const controlBtn = (() => {
    const start = SRC.indexOf('function ControlBtn(');
    expect(start, 'ControlBtn must exist').toBeGreaterThan(-1);
    const end = SRC.indexOf('\n}\n', start);
    return SRC.slice(start, end);
  })();

  it('uses theme-aware background (no hard-coded white surfaces)', () => {
    expect(controlBtn).toContain('c.bgElev');
    expect(controlBtn).not.toMatch(/rgba\(255,\s*255,\s*255,\s*0?\.9\d/);
  });

  it('uses themed border + text tokens for inactive state', () => {
    expect(controlBtn).toContain('c.borderStrong');
    expect(controlBtn).toContain('c.text');
  });

  it('keeps disabled opacity high enough to remain readable (>= 0.7)', () => {
    const m = controlBtn.match(/opacity:\s*disabled\s*\?\s*([0-9.]+)\s*:/);
    expect(m, 'disabled opacity branch must exist').toBeTruthy();
    expect(parseFloat(m![1])).toBeGreaterThanOrEqual(0.7);
  });

  it('uses accent-tinted background for active state (Hold/Mute/Record stay distinguishable)', () => {
    expect(controlBtn).toMatch(/active[\s\S]{0,200}color-mix/);
  });
});

describe('SoftphonePane — wide-mode dialer freeze regression', () => {
  it('Dialer is wrapped in React.memo', () => {
    expect(SRC).toMatch(/const Dialer\s*=\s*React\.memo\(\s*function Dialer/);
  });

  it('DialerKeypad is rendered through a memoized wrapper', () => {
    expect(SRC).toContain('const MemoKeypad = React.memo(DialerKeypad)');
    expect(SRC).toContain('<MemoKeypad');
  });

  it('keypad handlers are stabilized with useCallback (prevents per-keystroke re-render)', () => {
    // handleKey / handleBackspace / handleClear must be useCallback-bound.
    expect(SRC).toMatch(/const handleKey\s*=\s*useCallback\(/);
    expect(SRC).toMatch(/const handleBackspace\s*=\s*useCallback\(/);
    expect(SRC).toMatch(/const handleClear\s*=\s*useCallback\(/);
  });

  it('keypad onKey/onBackspace are NOT inline arrow props (would defeat memo)', () => {
    // Inline arrows like onKey={(k) => setDial(...)} reintroduce the freeze.
    const keypadUsage = SRC.match(/<MemoKeypad[\s\S]*?\/>/);
    expect(keypadUsage, 'MemoKeypad usage must exist').toBeTruthy();
    expect(keypadUsage![0]).not.toMatch(/onKey=\{\(/);
    expect(keypadUsage![0]).not.toMatch(/onBackspace=\{\(/);
  });
});
