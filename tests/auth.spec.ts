import { test, expect } from '@playwright/test';
import { TEST_USER } from './fixtures/test-utils';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
  });

  test('should display login form', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Connexion');
    await expect(page.locator('[name="email"]')).toBeVisible();
    await expect(page.locator('[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.fill('[name="email"]', 'invalid@example.com');
    await page.fill('[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('.toast-error, [role="alert"]')).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.fill('[name="email"]', TEST_USER.email);
    await page.fill('[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    
    // Should redirect to home after successful login
    await page.waitForURL('/', { timeout: 10000 });
    await expect(page.locator('h2')).toContainText('Bienvenue');
  });

  test('should navigate to signup form', async ({ page }) => {
    await page.click('text=Créer un compte');
    await expect(page.locator('[name="fullName"]')).toBeVisible();
  });

  test('should show password reset dialog', async ({ page }) => {
    await page.click('text=Mot de passe oublié');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('should signup new user', async ({ page }) => {
    await page.click('text=Créer un compte');
    
    const uniqueEmail = `test-${Date.now()}@example.com`;
    await page.fill('[name="fullName"]', 'New Test User');
    await page.fill('[name="email"]', uniqueEmail);
    await page.fill('[name="password"]', 'NewPassword123!');
    await page.click('button[type="submit"]');
    
    // Should redirect to home after successful signup
    await page.waitForURL('/', { timeout: 10000 });
  });

  test('should logout successfully', async ({ page }) => {
    // First login
    await page.fill('[name="email"]', TEST_USER.email);
    await page.fill('[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Then logout
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');
    
    await page.waitForURL('/auth');
    await expect(page.locator('h1')).toContainText('Connexion');
  });
});
