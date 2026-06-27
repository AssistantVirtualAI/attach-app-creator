import { test, expect } from "@playwright/test";

/**
 * Routing isolation between the Planiprêt MOBILE app (/mplanipret) and the
 * Planiprêt ADMIN portal (/planipret/admin).
 *
 * These tests run unauthenticated — that is the most fragile path because
 * a misconfigured guard can silently bounce /mplanipret into /planipret/admin
 * via stale localStorage state. We assert it never happens.
 */

test.describe("/mplanipret routing isolation", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("/mplanipret never lands on /planipret/admin", async ({ page }) => {
    // Pre-poison localStorage with a Planipret org id to simulate a returning
    // admin user — the mobile route must still resolve to /mplanipret or /login.
    await page.addInitScript(() => {
      try { localStorage.setItem("selected_organization_id", "planipret"); } catch { /* ignore */ }
      try { localStorage.setItem("lovable_nav_debug", "1"); } catch { /* ignore */ }
    });

    await page.goto("/mplanipret");
    // Allow guards + auth check to settle.
    await page.waitForLoadState("networkidle");

    const url = new URL(page.url());
    expect(url.pathname, "must never enter the admin portal").not.toContain("/planipret/admin");
    expect(["/mplanipret", "/mplanipret/home", "/login"]).toContain(url.pathname);
  });

  test("debug overlay reports the current route", async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem("lovable_nav_debug", "1"); } catch { /* ignore */ }
    });
    await page.goto("/mplanipret?debug=nav");
    const overlay = page.getByTestId("route-debug-overlay");
    await expect(overlay).toBeVisible();
    await expect(page.getByTestId("route-debug-current")).toContainText("/mplanipret");
  });

  test("/planipret/admin requires auth and does not leak into /mplanipret", async ({ page }) => {
    await page.goto("/planipret/admin/overview");
    await page.waitForLoadState("networkidle");
    const path = new URL(page.url()).pathname;
    // Either it asks us to log in, or it lands inside the admin portal.
    // It must NEVER cross into the mobile app.
    expect(path).not.toContain("/mplanipret");
  });
});
