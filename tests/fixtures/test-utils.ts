import { test as base, expect, Page } from '@playwright/test';

// Test user credentials
export const TEST_USER = {
  email: 'test@example.com',
  password: 'TestPassword123!',
  name: 'Test User',
};

export const TEST_CLIENT = {
  name: 'Test Client',
  email: 'client@example.com',
  language: 'fr',
  theme: 'light',
};

export const TEST_AGENT = {
  name: 'Test Agent',
  platform: 'elevenlabs',
  description: 'Test voice agent',
};

// Custom test fixture with authenticated user
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    // Navigate to auth page
    await page.goto('/auth');
    
    // Fill login form
    await page.fill('[name="email"]', TEST_USER.email);
    await page.fill('[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    
    // Wait for redirect to home
    await page.waitForURL('/');
    
    await use(page);
  },
});

// Helper functions
export async function login(page: Page, email: string, password: string) {
  await page.goto('/auth');
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
}

export async function logout(page: Page) {
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout-button"]');
  await page.waitForURL('/auth');
}

export async function createClient(page: Page, clientData: typeof TEST_CLIENT) {
  await page.goto('/clients');
  await page.click('[data-testid="add-client-button"]');
  await page.fill('[name="name"]', clientData.name);
  await page.fill('[name="email"]', clientData.email);
  await page.selectOption('[name="language"]', clientData.language);
  await page.selectOption('[name="theme"]', clientData.theme);
  await page.click('button[type="submit"]');
  await expect(page.locator('.toast-success')).toBeVisible();
}

export async function createAgent(page: Page, agentData: typeof TEST_AGENT) {
  await page.goto('/agents');
  await page.click('[data-testid="add-agent-button"]');
  
  // Step 1: Select platform
  await page.click(`[data-testid="platform-${agentData.platform}"]`);
  await page.click('[data-testid="next-step"]');
  
  // Step 2: Select integration (skip if no integrations)
  await page.click('[data-testid="next-step"]');
  
  // Step 3: Configure agent
  await page.fill('[name="name"]', agentData.name);
  await page.fill('[name="description"]', agentData.description);
  await page.click('button[type="submit"]');
  
  await expect(page.locator('.toast-success')).toBeVisible();
}

export { expect };
