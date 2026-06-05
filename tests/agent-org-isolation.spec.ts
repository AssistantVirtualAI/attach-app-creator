import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

/**
 * End-to-end org-isolation tests.
 *
 * Verifies that an account in org B (e.g. Lemtel) can never list, fetch,
 * or interact with agents owned by org A (e.g. AVA) through any of:
 *   - the agents_safe Data API view
 *   - the agents base table
 *   - the /agents UI route
 *   - the /audit-logs UI route
 *
 * Requires the following env vars to be set when running the suite:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY
 *   ORG_A_USER_EMAIL / ORG_A_USER_PASSWORD / ORG_A_ID  (AVA)
 *   ORG_B_USER_EMAIL / ORG_B_USER_PASSWORD / ORG_B_ID  (Lemtel)
 *
 * If those env vars are missing the test is skipped instead of failing,
 * so this file is safe to leave in CI even when secrets are not configured.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const ORG_A_ID = process.env.ORG_A_ID;
const ORG_B_ID = process.env.ORG_B_ID;
const A_EMAIL = process.env.ORG_A_USER_EMAIL;
const A_PASS = process.env.ORG_A_USER_PASSWORD;
const B_EMAIL = process.env.ORG_B_USER_EMAIL;
const B_PASS = process.env.ORG_B_USER_PASSWORD;

const HAS_ENV = !!(SUPABASE_URL && SUPABASE_ANON && ORG_A_ID && ORG_B_ID && A_EMAIL && A_PASS && B_EMAIL && B_PASS);

test.describe('Cross-org agent isolation', () => {
  test.skip(!HAS_ENV, 'Org-isolation env vars missing — skipping');

  test('Lemtel (org B) cannot list AVA (org A) agents via agents_safe', async () => {
    const supa = createClient(SUPABASE_URL!, SUPABASE_ANON!);
    await supa.auth.signInWithPassword({ email: B_EMAIL!, password: B_PASS! });

    const { data, error } = await supa
      .from('agents_safe')
      .select('id, organization_id')
      .eq('organization_id', ORG_A_ID!);

    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  test('Lemtel cannot fetch a specific AVA agent by id', async () => {
    const supaA = createClient(SUPABASE_URL!, SUPABASE_ANON!);
    await supaA.auth.signInWithPassword({ email: A_EMAIL!, password: A_PASS! });
    const { data: avaAgents } = await supaA
      .from('agents_safe')
      .select('id')
      .eq('organization_id', ORG_A_ID!)
      .limit(1);
    const avaAgentId = avaAgents?.[0]?.id;
    test.skip(!avaAgentId, 'No AVA agent to probe');

    const supaB = createClient(SUPABASE_URL!, SUPABASE_ANON!);
    await supaB.auth.signInWithPassword({ email: B_EMAIL!, password: B_PASS! });

    const { data } = await supaB.from('agents_safe').select('*').eq('id', avaAgentId!).maybeSingle();
    expect(data).toBeNull();

    const { data: base } = await supaB.from('agents').select('*').eq('id', avaAgentId!).maybeSingle();
    expect(base).toBeNull();
  });

  test('Lemtel /agents UI shows zero AVA agents', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', B_EMAIL!);
    await page.fill('input[type="password"]', B_PASS!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|home|agents)/);
    await page.goto('/agents');

    // Capture all agent rows; none should reference ORG_A_ID
    const html = await page.content();
    expect(html).not.toContain(ORG_A_ID!);
  });

  test('Lemtel /audit-logs cannot reveal AVA org log entries', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', B_EMAIL!);
    await page.fill('input[type="password"]', B_PASS!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|home|agents)/);
    await page.goto('/audit-logs');
    const html = await page.content();
    expect(html).not.toContain(ORG_A_ID!);
  });
});
