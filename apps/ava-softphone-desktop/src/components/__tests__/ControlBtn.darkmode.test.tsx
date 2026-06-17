/**
 * Dark-mode visual regression for ControlBtn — Hold, Mute, Transfer, Record.
 *
 * Verifies the rendered inline styles never collapse to white-on-white
 * (the original dark-mode invisibility bug) across all four states:
 * inactive, active, hover, disabled.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ControlBtn } from '../SoftphonePane';

// Drive the static `theme` proxy into dark-mode values via CSS variables.
// theme.ts reads through `v('text', ...)` → var(--ava-text, fallback).
function applyDarkThemeVars() {
  const root = document.documentElement;
  root.style.setProperty('--ava-bg', '#0b1124');
  root.style.setProperty('--ava-surface', 'rgba(255,255,255,0.05)');
  root.style.setProperty('--ava-surface-elev', 'rgba(255,255,255,0.08)');
  root.style.setProperty('--ava-surface-hover', 'rgba(255,255,255,0.12)');
  root.style.setProperty('--ava-border', 'rgba(180,200,255,0.14)');
  root.style.setProperty('--ava-border-strong', 'rgba(180,200,255,0.28)');
  root.style.setProperty('--ava-text', '#f3f7ff');
  root.style.setProperty('--ava-text-muted', '#b8c6e8');
  root.style.setProperty('--ava-text-subtle', '#8a9bc4');
  root.setAttribute('data-ava-theme', 'dark');
}

const LABELS = ['Hold', 'Mute', 'Blind Xfer', 'Record'] as const;

beforeEach(() => {
  applyDarkThemeVars();
  cleanup();
});

describe('ControlBtn — dark mode visibility (inactive)', () => {
  it.each(LABELS)('%s is visible and readable when inactive', (label) => {
    render(<ControlBtn icon="•" label={label} onClick={() => {}} />);
    const btn = screen.getByRole('button', { name: label });
    const style = btn.style;
    // Background must use the themed elevated surface (CSS var), never a
    // hard-coded near-white color that hid the label in dark mode.
    expect(style.background).toContain('--ava-surface-elev');
    // Border + color must use themed tokens.
    expect(style.border).toContain('--ava-border-strong');
    expect(style.color).toContain('--ava-text');
    // Opacity must remain readable.
    expect(parseFloat(style.opacity || '1')).toBeGreaterThanOrEqual(0.7);
    expect(btn).not.toBeDisabled();
  });
});

describe('ControlBtn — dark mode visibility (active)', () => {
  it.each(LABELS)('%s active state uses accent tint, not white-on-white', (label) => {
    render(<ControlBtn icon="•" label={label} onClick={() => {}} active danger={label === 'Mute'} warning={label === 'Hold'} />);
    const btn = screen.getByRole('button', { name: label });
    // color-mix accent tint applied on top of themed surface, never raw white.
    expect(btn.style.background).toContain('color-mix');
    expect(btn.style.background).not.toMatch(/rgba\(255,\s*255,\s*255,\s*0?\.9/);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('ControlBtn — dark mode visibility (hover)', () => {
  it.each(LABELS)('%s stays readable after pointer hover (no opacity collapse)', (label) => {
    render(<ControlBtn icon="•" label={label} onClick={() => {}} />);
    const btn = screen.getByRole('button', { name: label });
    fireEvent.mouseEnter(btn);
    fireEvent.pointerEnter(btn);
    // Hover never reduces opacity below the readability floor.
    expect(parseFloat(btn.style.opacity || '1')).toBeGreaterThanOrEqual(0.7);
    // Color token unchanged on hover.
    expect(btn.style.color).toContain('--ava-text');
  });
});

describe('ControlBtn — dark mode visibility (disabled)', () => {
  it.each(LABELS)('%s disabled state remains readable (opacity >= 0.7)', (label) => {
    render(<ControlBtn icon="•" label={label} onClick={() => {}} disabled />);
    const btn = screen.getByRole('button', { name: label });
    expect(btn).toBeDisabled();
    expect(parseFloat(btn.style.opacity || '1')).toBeGreaterThanOrEqual(0.7);
    // Even disabled, the label color must use the themed text token.
    expect(btn.style.color).toContain('--ava-text');
    expect(btn).toHaveTextContent(label);
  });
});
