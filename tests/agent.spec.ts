import { test, expect } from './fixtures/test-utils';
import { TEST_AGENT } from './fixtures/test-utils';

test.describe('Agent Management', () => {
  test('should display agents list', async ({ authenticatedPage: page }) => {
    await page.goto('/agents');
    
    await expect(page.locator('h2')).toContainText('Agents');
    await expect(page.locator('[data-testid="add-agent-button"]')).toBeVisible();
  });

  test('should open add agent modal with platform selection', async ({ authenticatedPage: page }) => {
    await page.goto('/agents');
    await page.click('[data-testid="add-agent-button"]');
    
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // Check platform options are visible
    await expect(page.locator('[data-testid="platform-elevenlabs"]')).toBeVisible();
    await expect(page.locator('[data-testid="platform-vapi"]')).toBeVisible();
    await expect(page.locator('[data-testid="platform-retell"]')).toBeVisible();
  });

  test('should navigate through agent creation steps', async ({ authenticatedPage: page }) => {
    await page.goto('/agents');
    await page.click('[data-testid="add-agent-button"]');
    
    // Step 1: Select platform
    await page.click('[data-testid="platform-elevenlabs"]');
    await page.click('[data-testid="next-step"]');
    
    // Step 2: Integration selection should be visible
    await expect(page.locator('[data-testid="step-2"]')).toBeVisible();
    await page.click('[data-testid="next-step"]');
    
    // Step 3: Agent configuration should be visible
    await expect(page.locator('[name="name"]')).toBeVisible();
  });

  test('should create new agent', async ({ authenticatedPage: page }) => {
    await page.goto('/agents');
    await page.click('[data-testid="add-agent-button"]');
    
    // Step 1: Select platform
    await page.click('[data-testid="platform-elevenlabs"]');
    await page.click('[data-testid="next-step"]');
    
    // Step 2: Skip integration
    await page.click('[data-testid="next-step"]');
    
    // Step 3: Configure agent
    const uniqueName = `Test Agent ${Date.now()}`;
    await page.fill('[name="name"]', uniqueName);
    await page.fill('[name="description"]', 'E2E test agent');
    await page.click('button[type="submit"]');
    
    // Should redirect to agent settings
    await page.waitForURL(/\/agent-settings\/[a-z0-9-]+/);
  });

  test('should navigate to agent settings', async ({ authenticatedPage: page }) => {
    await page.goto('/agents');
    
    const firstAgent = page.locator('[data-testid="agent-row"]').first();
    if (await firstAgent.isVisible()) {
      await firstAgent.click();
      await page.waitForURL(/\/agent-settings\/[a-z0-9-]+/);
      
      // Check tabs are present
      await expect(page.locator('[data-testid="tab-overview"]')).toBeVisible();
      await expect(page.locator('[data-testid="tab-credentials"]')).toBeVisible();
      await expect(page.locator('[data-testid="tab-widget"]')).toBeVisible();
    }
  });

  test('should test agent credentials connection', async ({ authenticatedPage: page }) => {
    await page.goto('/agents');
    
    const firstAgent = page.locator('[data-testid="agent-row"]').first();
    if (await firstAgent.isVisible()) {
      await firstAgent.click();
      await page.waitForURL(/\/agent-settings\/[a-z0-9-]+/);
      
      // Navigate to credentials tab
      await page.click('[data-testid="tab-credentials"]');
      
      // Check test connection button
      const testButton = page.locator('[data-testid="test-connection-button"]');
      if (await testButton.isVisible()) {
        await expect(testButton).toBeEnabled();
      }
    }
  });

  test('should configure widget appearance', async ({ authenticatedPage: page }) => {
    await page.goto('/agents');
    
    const firstAgent = page.locator('[data-testid="agent-row"]').first();
    if (await firstAgent.isVisible()) {
      await firstAgent.click();
      await page.waitForURL(/\/agent-settings\/[a-z0-9-]+/);
      
      // Navigate to widget tab
      await page.click('[data-testid="tab-widget"]');
      
      // Check widget configuration options
      await expect(page.locator('[data-testid="widget-layout-selector"]')).toBeVisible();
    }
  });
});
