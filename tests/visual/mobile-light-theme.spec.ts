/**
 * Playwright visual regression — mobile softphone in LIGHT mode.
 *
 * Captures full-page screenshots of the main screens at common
 * breakpoints. Baselines live next to this file as
 * mobile-light-theme.spec.ts-snapshots/ and are committed to git.
 * A pixel diff > the threshold fails CI.
 *
 * Run locally:
 *   npx playwright test tests/visual/mobile-light-theme.spec.ts
 * Update baselines after intentional design changes:
 *   npx playwright test tests/visual/mobile-light-theme.spec.ts --update-snapshots
 *
 * The mobile app is served at /m by the root Vite dev server.
 */
import { test, expect, type Page } from '@playwright/test';

const BREAKPOINTS = [
  { name: 'mobile-375',  width: 375,  height: 812 },
  { name: 'tablet-768',  width: 768,  height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 800 },
] as const;

const SCREENS = [
  { name: 'home',      tab: 'home' },
  { name: 'history',   tab: 'calls' },
  { name: 'chat',      tab: 'messages' },
  { name: 'settings',  tab: 'settings' },
] as const;

async function forceLightMode(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('ava.theme.mode', 'light'); } catch {}
  });
}

test.describe('mobile light-mode visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await forceLightMode(page);
  });

  for (const bp of BREAKPOINTS) {
    test.describe(`@${bp.name}`, () => {
      test.use({ viewport: { width: bp.width, height: bp.height } });

      test('bottom navigation chrome', async ({ page }) => {
        await page.goto('/m');
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveScreenshot(`bottomnav-${bp.name}-light.png`, {
          fullPage: false,
          maxDiffPixelRatio: 0.02,
          animations: 'disabled',
        });
      });

      for (const screen of SCREENS) {
        test(`${screen.name} screen`, async ({ page }) => {
          await page.goto(`/m?tab=${screen.tab}`);
          await page.waitForLoadState('networkidle');
          // Give the theme attribute a tick to apply.
          await page.waitForFunction(
            () => document.documentElement.getAttribute('data-theme') === 'light',
            { timeout: 2000 },
          ).catch(() => {});
          await expect(page).toHaveScreenshot(
            `${screen.name}-${bp.name}-light.png`,
            { fullPage: true, maxDiffPixelRatio: 0.02, animations: 'disabled' },
          );
        });
      }
    });
  }
});
