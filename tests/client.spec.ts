import { test, expect } from './fixtures/test-utils';
import { TEST_CLIENT } from './fixtures/test-utils';

test.describe('Client Management', () => {
  test('should display clients list', async ({ authenticatedPage: page }) => {
    await page.goto('/clients');
    
    await expect(page.locator('h2')).toContainText('Clients');
    await expect(page.locator('[data-testid="add-client-button"]')).toBeVisible();
  });

  test('should open add client modal', async ({ authenticatedPage: page }) => {
    await page.goto('/clients');
    await page.click('[data-testid="add-client-button"]');
    
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('[name="name"]')).toBeVisible();
  });

  test('should create new client', async ({ authenticatedPage: page }) => {
    await page.goto('/clients');
    await page.click('[data-testid="add-client-button"]');
    
    const uniqueName = `Test Client ${Date.now()}`;
    await page.fill('[name="name"]', uniqueName);
    await page.fill('[name="email"]', `client-${Date.now()}@example.com`);
    await page.selectOption('[name="language"]', 'fr');
    await page.selectOption('[name="theme"]', 'light');
    await page.click('button[type="submit"]');
    
    // Should redirect to client detail page
    await page.waitForURL(/\/clients\/[a-z0-9-]+/);
    await expect(page.locator('h2')).toContainText(uniqueName);
  });

  test('should filter clients by status', async ({ authenticatedPage: page }) => {
    await page.goto('/clients');
    
    // Click active filter
    await page.click('[data-testid="filter-active"]');
    await expect(page.locator('[data-testid="filter-active"]')).toHaveClass(/active/);
    
    // Click inactive filter
    await page.click('[data-testid="filter-inactive"]');
    await expect(page.locator('[data-testid="filter-inactive"]')).toHaveClass(/active/);
  });

  test('should navigate to client detail', async ({ authenticatedPage: page }) => {
    await page.goto('/clients');
    
    // Click on first client in list
    const firstClient = page.locator('[data-testid="client-row"]').first();
    if (await firstClient.isVisible()) {
      await firstClient.click();
      await page.waitForURL(/\/clients\/[a-z0-9-]+/);
      await expect(page.locator('[data-testid="client-tabs"]')).toBeVisible();
    }
  });

  test('should display client detail tabs', async ({ authenticatedPage: page }) => {
    await page.goto('/clients');
    
    const firstClient = page.locator('[data-testid="client-row"]').first();
    if (await firstClient.isVisible()) {
      await firstClient.click();
      await page.waitForURL(/\/clients\/[a-z0-9-]+/);
      
      // Check all tabs are present
      await expect(page.locator('[data-testid="tab-overview"]')).toBeVisible();
      await expect(page.locator('[data-testid="tab-agents"]')).toBeVisible();
      await expect(page.locator('[data-testid="tab-access"]')).toBeVisible();
      await expect(page.locator('[data-testid="tab-url"]')).toBeVisible();
    }
  });

  test('should update client access controls', async ({ authenticatedPage: page }) => {
    await page.goto('/clients');
    
    const firstClient = page.locator('[data-testid="client-row"]').first();
    if (await firstClient.isVisible()) {
      await firstClient.click();
      await page.waitForURL(/\/clients\/[a-z0-9-]+/);
      
      // Navigate to access tab
      await page.click('[data-testid="tab-access"]');
      
      // Toggle a permission
      const permissionToggle = page.locator('[data-testid="permission-view-conversations"]');
      if (await permissionToggle.isVisible()) {
        await permissionToggle.click();
        await expect(page.locator('.toast-success')).toBeVisible();
      }
    }
  });
});
