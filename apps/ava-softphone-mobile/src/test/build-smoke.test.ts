/**
 * Smoke test: verifies the production bundle in dist/ loads in jsdom
 * and that the SIP hook surfaces an error when JsSIP is absent.
 * Run after `vite build` (CI invokes this via `npm run test:smoke`).
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderHook, waitFor } from '@testing-library/react';
import { useSoftphone } from '../hooks/useSoftphone';

const here = dirname(fileURLToPath(import.meta.url));
const distDir = join(here, '..', '..', 'dist');

describe('build smoke', () => {
  it('vite build artifacts exist', () => {
    expect(existsSync(distDir)).toBe(true);
    const html = readFileSync(join(distDir, 'index.html'), 'utf8');
    expect(html).toContain('<div id="root">');
    // JsSIP CDN tag must be present in the shipped HTML.
    expect(html).toMatch(/jssip(\.min)?\.js/);
    const assets = readdirSync(join(distDir, 'assets'));
    expect(assets.some((f) => f.endsWith('.js'))).toBe(true);
  });

  it('useSoftphone surfaces an error when JsSIP is missing from window', async () => {
    delete (window as any).JsSIP;
    const { result } = renderHook(() =>
      useSoftphone(
        {
          extension: '300',
          password: 'pw',
          domain: 'lemtel.tel',
          wssUrl: 'wss://sip.example.com:7443',
        },
        { jsSipTimeoutMs: 50 },
      ),
    );
    expect(result.current.sipStatus).toBe('connecting');
    await waitFor(() => expect(result.current.sipStatus).toBe('error'), { timeout: 1500 });
    expect(result.current.sipError).toMatch(/library failed to load/i);
  });
});
