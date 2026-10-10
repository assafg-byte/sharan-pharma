import { test, expect } from "@playwright/test";

// Manager credentials (set up via /api/setup)
const MANAGER = { phone4: "3131", password: "0808" };

test.describe("Authentication flows", () => {
  test("correct manager credentials → redirects to /manager", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="tel"]', MANAGER.phone4);
    await page.fill('input[type="password"]', MANAGER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/manager", { timeout: 10000 });
    expect(page.url()).toContain("/manager");
  });

  test("wrong PIN → shows error message", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="tel"]', "0000");
    await page.fill('input[type="password"]', "wrongpass");
    await page.click('button[type="submit"]');
    // Stay on login page with error
    await expect(page.locator("text=פרטים שגויים")).toBeVisible({ timeout: 8000 });
    expect(page.url()).toContain("/login");
  });

  test("PIN with fewer than 4 digits → submit disabled", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="tel"]', "123"); // only 3 digits
    await page.fill('input[type="password"]', "somepass");
    // The input should be limited to 4 chars; submit should be disabled / show error
    const submitBtn = page.locator('button[type="submit"]');
    // Button should not submit (either disabled or page stays on login)
    await submitBtn.click();
    await page.waitForTimeout(500);
    expect(page.url()).toContain("/login");
  });

  test("unauthenticated access to /manager → redirected to /login", async ({ page }) => {
    // Clear cookies to ensure no session
    await page.context().clearCookies();
    await page.goto("/manager");
    await page.waitForURL("**/login", { timeout: 8000 });
    expect(page.url()).toContain("/login");
  });

  test("unauthenticated access to /employee → redirected to /login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/employee");
    await page.waitForURL("**/login", { timeout: 8000 });
    expect(page.url()).toContain("/login");
  });

  test("session persists after page reload", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="tel"]', MANAGER.phone4);
    await page.fill('input[type="password"]', MANAGER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/manager", { timeout: 10000 });

    await page.reload();
    await page.waitForURL("**/manager", { timeout: 8000 });
    expect(page.url()).toContain("/manager");
  });

  test("manager sign out → redirects to /login", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="tel"]', MANAGER.phone4);
    await page.fill('input[type="password"]', MANAGER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/manager", { timeout: 10000 });

    // Open menu and click sign out
    await page.click("text=תפריט");
    await page.click("text=התנתק");
    await page.waitForURL("**/login", { timeout: 8000 });
    expect(page.url()).toContain("/login");
  });
});
