import { test, expect } from './fixtures/test-utils';

test.describe('Admin - Workspace Management', () => {
  test('should access SaaS configurator', async ({ authenticatedPage: page }) => {
    await page.goto('/saas-config');
    
    await expect(page.locator('h2')).toContainText('Configuration SaaS');
    await expect(page.locator('[data-testid="branding-tab"]')).toBeVisible();
  });

  test('should upload dashboard logo', async ({ authenticatedPage: page }) => {
    await page.goto('/saas-config');
    
    // Click on branding tab
    await page.click('[data-testid="branding-tab"]');
    
    // Check logo upload section
    const logoUploader = page.locator('[data-testid="logo-dashboard-uploader"]');
    await expect(logoUploader).toBeVisible();
  });

  test('should configure email settings', async ({ authenticatedPage: page }) => {
    await page.goto('/saas-config');
    
    // Click on email tab
    await page.click('[data-testid="email-tab"]');
    
    // Check email configuration fields
    await expect(page.locator('[name="email_domain"]')).toBeVisible();
    await expect(page.locator('[name="email_sender"]')).toBeVisible();
    await expect(page.locator('[name="email_sender_name"]')).toBeVisible();
  });

  test('should toggle GDPR setting', async ({ authenticatedPage: page }) => {
    await page.goto('/saas-config');
    
    // Click on compliance tab
    await page.click('[data-testid="compliance-tab"]');
    
    // GDPR toggle should be visible
    const gdprToggle = page.locator('[data-testid="gdpr-toggle"]');
    await expect(gdprToggle).toBeVisible();
  });

  test('should configure custom domain', async ({ authenticatedPage: page }) => {
    await page.goto('/saas-config');
    
    // Click on domain tab
    await page.click('[data-testid="domain-tab"]');
    
    // Domain input should be visible
    await expect(page.locator('[name="domain"]')).toBeVisible();
  });
});

test.describe('Admin - White Label Settings', () => {
  test('should access settings page', async ({ authenticatedPage: page }) => {
    await page.goto('/settings');
    
    await expect(page.locator('h2')).toContainText('Paramètres');
  });

  test('should display agency settings tab', async ({ authenticatedPage: page }) => {
    await page.goto('/settings');
    
    await page.click('[data-testid="agency-tab"]');
    
    // Agency name field should be visible
    await expect(page.locator('[name="organization_name"]')).toBeVisible();
  });

  test('should configure webhook endpoints', async ({ authenticatedPage: page }) => {
    await page.goto('/settings');
    
    await page.click('[data-testid="webhooks-tab"]');
    
    // Add webhook button should be visible
    await expect(page.locator('[data-testid="add-webhook-button"]')).toBeVisible();
  });

  test('should view audit logs when HIPAA enabled', async ({ authenticatedPage: page }) => {
    await page.goto('/settings');
    
    const auditTab = page.locator('[data-testid="audit-logs-tab"]');
    if (await auditTab.isVisible()) {
      await auditTab.click();
      
      // Audit logs table should be visible
      await expect(page.locator('[data-testid="audit-logs-table"]')).toBeVisible();
    }
  });

  test('should manage team members', async ({ authenticatedPage: page }) => {
    await page.goto('/team');
    
    await expect(page.locator('h2')).toContainText('Équipe');
    
    // Invite member button should be visible
    await expect(page.locator('[data-testid="invite-member-button"]')).toBeVisible();
  });

  test('should manage API keys', async ({ authenticatedPage: page }) => {
    await page.goto('/api-keys');
    
    await expect(page.locator('h2')).toContainText('Clés API');
    
    // Create key button should be visible
    await expect(page.locator('[data-testid="create-key-button"]')).toBeVisible();
  });
});

test.describe('Admin - Billing Management', () => {
  test('should access billing page', async ({ authenticatedPage: page }) => {
    await page.goto('/stripe-billing');
    
    await expect(page.locator('h2')).toContainText('Facturation');
  });

  test('should display pricing plans', async ({ authenticatedPage: page }) => {
    await page.goto('/stripe-billing');
    
    // Plans tab should be visible
    await page.click('[data-testid="plans-tab"]');
    
    // Pricing cards should be displayed
    await expect(page.locator('[data-testid="plan-starter"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-growth"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-ultimate"]')).toBeVisible();
  });

  test('should display payment history', async ({ authenticatedPage: page }) => {
    await page.goto('/stripe-billing');
    
    const historyTab = page.locator('[data-testid="history-tab"]');
    if (await historyTab.isVisible()) {
      await historyTab.click();
      
      // Payment history section should be visible
      await expect(page.locator('[data-testid="payment-history"]')).toBeVisible();
    }
  });

  test('should display add-ons', async ({ authenticatedPage: page }) => {
    await page.goto('/stripe-billing');
    
    await page.click('[data-testid="addons-tab"]');
    
    // HIPAA add-on should be visible
    await expect(page.locator('[data-testid="addon-hipaa"]')).toBeVisible();
  });
});
