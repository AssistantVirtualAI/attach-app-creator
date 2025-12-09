import { test, expect } from '@playwright/test';

test.describe('Client Portal - Login', () => {
  test('should display client login page', async ({ page }) => {
    await page.goto('/client/login');
    
    await expect(page.locator('h1')).toContainText('Connexion');
    await expect(page.locator('[name="loginId"]')).toBeVisible();
  });

  test('should show error for invalid login', async ({ page }) => {
    await page.goto('/client/login');
    
    await page.fill('[name="loginId"]', 'invalid-login-id');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('.toast-error, [role="alert"]')).toBeVisible();
  });

  test('should login with valid client credentials', async ({ page }) => {
    // This requires a seeded test client with known login_id
    const testLoginId = 'test-client-login';
    
    await page.goto('/client/login');
    await page.fill('[name="loginId"]', testLoginId);
    await page.click('button[type="submit"]');
    
    // Should redirect to client portal
    await page.waitForURL(/\/client\/[a-z0-9-]+/, { timeout: 10000 });
  });
});

test.describe('Client Portal - Dashboard', () => {
  // Use fixture with authenticated client
  const testClientId = 'test-client-id';

  test.beforeEach(async ({ page }) => {
    // Simulate client authentication
    await page.goto(`/client/${testClientId}`);
  });

  test('should display client dashboard', async ({ page }) => {
    await expect(page.locator('[data-testid="client-dashboard"]')).toBeVisible();
  });

  test('should show limited navigation', async ({ page }) => {
    // Client should only see limited menu items
    const nav = page.locator('[data-testid="client-nav"]');
    
    await expect(nav.locator('text=Conversations')).toBeVisible();
    await expect(nav.locator('text=Analytics')).toBeVisible();
    
    // Should NOT see admin features
    await expect(nav.locator('text=Settings')).not.toBeVisible();
    await expect(nav.locator('text=Billing')).not.toBeVisible();
  });
});

test.describe('Client Portal - Analytics', () => {
  const testClientId = 'test-client-id';

  test('should view client analytics', async ({ page }) => {
    await page.goto(`/client/${testClientId}/analytics`);
    
    // Analytics charts should be visible
    await expect(page.locator('[data-testid="analytics-chart"]')).toBeVisible();
  });

  test('should filter analytics by date range', async ({ page }) => {
    await page.goto(`/client/${testClientId}/analytics`);
    
    // Date filter should be available
    const dateFilter = page.locator('[data-testid="date-range-filter"]');
    if (await dateFilter.isVisible()) {
      await dateFilter.click();
      await page.click('text=7 derniers jours');
      
      // Analytics should refresh
      await expect(page.locator('[data-testid="analytics-chart"]')).toBeVisible();
    }
  });
});

test.describe('Client Portal - Conversations', () => {
  const testClientId = 'test-client-id';

  test('should view conversations list', async ({ page }) => {
    await page.goto(`/client/${testClientId}/conversations`);
    
    await expect(page.locator('h2')).toContainText('Conversations');
  });

  test('should view conversation detail', async ({ page }) => {
    await page.goto(`/client/${testClientId}/conversations`);
    
    const firstConversation = page.locator('[data-testid="conversation-row"]').first();
    if (await firstConversation.isVisible()) {
      await firstConversation.click();
      
      // Conversation detail modal should appear
      await expect(page.locator('[data-testid="conversation-detail"]')).toBeVisible();
    }
  });

  test('should export conversations', async ({ page }) => {
    await page.goto(`/client/${testClientId}/conversations`);
    
    const exportButton = page.locator('[data-testid="export-button"]');
    if (await exportButton.isVisible()) {
      // Start download
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        exportButton.click(),
      ]);
      
      // Verify download started
      expect(download.suggestedFilename()).toContain('conversations');
    }
  });

  test('should filter conversations', async ({ page }) => {
    await page.goto(`/client/${testClientId}/conversations`);
    
    // Filter by sentiment
    const sentimentFilter = page.locator('[data-testid="sentiment-filter"]');
    if (await sentimentFilter.isVisible()) {
      await sentimentFilter.selectOption('positive');
      
      // Results should update
      await page.waitForTimeout(500);
    }
  });
});
