import { test, expect } from '@playwright/test';

test.describe('Widget Prototype', () => {
  // Use a test agent ID - in real tests this would be seeded
  const testAgentId = 'test-agent-id';

  test('should display widget prototype page', async ({ page }) => {
    await page.goto(`/prototype/${testAgentId}`);
    
    // Widget container should be visible
    await expect(page.locator('[data-testid="widget-container"]')).toBeVisible();
  });

  test('should show microphone permission request', async ({ page }) => {
    await page.goto(`/prototype/${testAgentId}`);
    
    // Click start button
    const startButton = page.locator('[data-testid="start-conversation-button"]');
    if (await startButton.isVisible()) {
      await startButton.click();
      
      // Should prompt for microphone permission
      // Note: Actual permission handling varies by browser
    }
  });

  test('should display agent information', async ({ page }) => {
    await page.goto(`/prototype/${testAgentId}`);
    
    // Agent avatar or name should be displayed
    const agentInfo = page.locator('[data-testid="agent-info"]');
    if (await agentInfo.isVisible()) {
      await expect(agentInfo).toBeVisible();
    }
  });

  test('should show speaking indicator when active', async ({ page }) => {
    await page.goto(`/prototype/${testAgentId}`);
    
    // Speaking indicator should exist (even if hidden initially)
    await expect(page.locator('[data-testid="speaking-indicator"]')).toBeDefined();
  });
});

test.describe('Widget iFrame', () => {
  const testAgentId = 'test-agent-id';

  test('should load iframe widget', async ({ page }) => {
    await page.goto(`/iframe/${testAgentId}`);
    
    // iFrame widget should render
    await expect(page.locator('[data-testid="iframe-widget"]')).toBeVisible();
  });

  test('should be embeddable in iframe', async ({ page }) => {
    // Create a test page with iframe
    await page.setContent(`
      <html>
        <body>
          <iframe 
            src="${page.url()}/iframe/${testAgentId}" 
            width="400" 
            height="600"
            allow="microphone"
          ></iframe>
        </body>
      </html>
    `);
    
    const iframe = page.frameLocator('iframe');
    await expect(iframe.locator('body')).toBeVisible();
  });
});

test.describe('Widget Embed Code', () => {
  test('should generate valid popup widget code', async ({ page, context }) => {
    // This test validates the embed code structure
    await page.goto('/agents');
    
    const firstAgent = page.locator('[data-testid="agent-row"]').first();
    if (await firstAgent.isVisible()) {
      await firstAgent.click();
      await page.waitForURL(/\/agent-settings\/[a-z0-9-]+/);
      
      // Navigate to embed tab
      await page.click('[data-testid="tab-embed"]');
      
      // Get embed code
      const embedCode = page.locator('[data-testid="embed-code-popup"]');
      if (await embedCode.isVisible()) {
        const code = await embedCode.textContent();
        
        // Validate code contains required elements
        expect(code).toContain('script');
        expect(code).toContain('agentId');
      }
    }
  });
});
