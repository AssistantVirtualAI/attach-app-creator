import { expect, test } from '@playwright/test';

test.describe('MessagesView desktop', () => {
  test('loads mock threads, opens a conversation, and sends a draft message', async ({ page }) => {
    await page.goto('/?testHarness=messages');

    await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();
    await expect(page.getByText('Acme Corp')).toBeVisible();

    await page.getByRole('button', { name: /Acme Corp/ }).dispatchEvent('click');
    await expect(page.getByText('Can we reschedule to Thursday?').last()).toBeVisible();

    const composer = page.getByPlaceholder('Type a message…');
    await composer.fill('Confirmed for Thursday at the same time.');
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(page.getByText('Confirmed for Thursday at the same time.')).toBeVisible();
    await expect(page.getByText(/sent/i)).toBeVisible();
  });

  test('template picker can insert a reusable message', async ({ page }) => {
    await page.goto('/?testHarness=messages');

    await page.getByRole('button', { name: /Marie Tremblay/ }).first().dispatchEvent('click');
    await page.getByRole('button', { name: /Templates/ }).click();
    await page.getByPlaceholder('Search templates…').fill('follow');
    await page.getByRole('button', { name: /Voicemail follow-up/i }).dispatchEvent('click');

    await expect(page.getByPlaceholder('Type a message…')).not.toBeEmpty();
  });
});
