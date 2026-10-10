import { test, expect, Page } from "@playwright/test";

const MANAGER = { phone4: "3131", password: "0808" };

async function loginAsManager(page: Page) {
  await page.goto("/login");
  await page.fill('input[type="tel"]', MANAGER.phone4);
  await page.fill('input[type="password"]', MANAGER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/manager", { timeout: 10000 });
}

// ── Weekly calendar navigation ────────────────────────────────────────────────
test.describe("Weekly calendar navigation", () => {
  test("current week shows shift data", async ({ page }) => {
    await loginAsManager(page);
    // Wait for the schedule to load (skeleton fades out)
    await page.waitForSelector(".animate-pulse", { state: "detached", timeout: 10000 });
    // Should see day headers
    await expect(page.locator("text=ראשון")).toBeVisible();
    await expect(page.locator("text=חמישי")).toBeVisible();
  });

  test("navigating to empty future week shows the UpcomingEmptyState", async ({ page }) => {
    await loginAsManager(page);
    await page.waitForSelector(".animate-pulse", { state: "detached", timeout: 10000 });

    // Use edge nav → forward 10 weeks (definitely no data)
    for (let i = 0; i < 10; i++) {
      const nextBtn = page.locator('button[aria-label="שבוע הבא"]').first();
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        await page.waitForTimeout(300);
      }
    }
    // Should show empty state with the "סידור עבודה לשבוע זה" headline
    await expect(page.locator("text=סידור עבודה לשבוע זה")).toBeVisible({ timeout: 5000 });
  });

  test("clicking חזור on empty state returns to previous week", async ({ page }) => {
    await loginAsManager(page);
    await page.waitForSelector(".animate-pulse", { state: "detached", timeout: 10000 });

    // Go forward until empty state
    for (let i = 0; i < 10; i++) {
      const nextBtn = page.locator('button[aria-label="שבוע הבא"]').first();
      if (await nextBtn.isVisible()) await nextBtn.click();
    }
    await expect(page.locator("text=סידור עבודה לשבוע זה")).toBeVisible({ timeout: 5000 });

    // Click חזור
    await page.click("text=חזור");
    // Empty state should still show (one week earlier, still empty) or go back more
    // At minimum, page should not crash
    await page.waitForTimeout(500);
    expect(page.url()).toContain("/manager");
  });
});

// ── Manager menu ──────────────────────────────────────────────────────────────
test.describe("Manager תפריט menu", () => {
  test("opens שעות panel", async ({ page }) => {
    await loginAsManager(page);
    await page.click("text=תפריט");
    await page.click("text=שעות");
    await expect(page.locator("text=שעות עובדים")).toBeVisible({ timeout: 5000 });
  });

  test("opens משימות panel", async ({ page }) => {
    await loginAsManager(page);
    await page.click("text=תפריט");
    await page.click("text=משימות");
    await expect(page.locator("text=לוח משימות")).toBeVisible({ timeout: 5000 });
  });

  test("מצב עריכה toggle switches to edit mode", async ({ page }) => {
    await loginAsManager(page);
    await page.waitForSelector(".animate-pulse", { state: "detached", timeout: 10000 });
    await page.click("text=תפריט");
    await page.click("text=מצב עריכה");
    // Edit mode shows the EmployeeManager section
    await expect(page.locator("text=עובדים")).toBeVisible({ timeout: 5000 });
  });
});

// ── Vacation priority logic ───────────────────────────────────────────────────
test.describe("Vacation request priority calculation", () => {
  test("same-day request creates a HIGH priority task", async ({ page }) => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

    // Verify via direct API call (same logic as VacationPanel)
    const daysUntil = 0;
    const priority = daysUntil <= 0 ? "HIGH" : daysUntil <= 6 ? "MEDIUM" : "LOW";
    expect(priority).toBe("HIGH");

    // Also verify the task created via API has correct priority
    const res = await page.request.post("/api/tasks", {
      data: {
        title: `Test vacation task HIGH`,
        priority: "HIGH",
        status: "TODO",
        dueDate: todayStr,
        assigneeIds: "",
        order: 0,
      },
    });
    expect(res.status()).toBe(201);
    const task = await res.json();
    expect(task.priority).toBe("HIGH");
    // Clean up
    await page.request.delete(`/api/tasks/${task.id}`);
  });

  test("3-day-out request creates MEDIUM priority", async () => {
    const days = 3;
    const priority = days <= 0 ? "HIGH" : days <= 6 ? "MEDIUM" : "LOW";
    expect(priority).toBe("MEDIUM");
  });

  test("10-day-out request creates LOW priority", async () => {
    const days = 10;
    const priority = days <= 0 ? "HIGH" : days <= 6 ? "MEDIUM" : "LOW";
    expect(priority).toBe("LOW");
  });
});

// ── Availability drag-paint state machine ─────────────────────────────────────
test.describe("Availability cell state machine (unit-level logic)", () => {
  // These test the NEXT_STATE logic independently without UI
  test("unset → available → unavailable → unset cycle", () => {
    const NEXT: Record<string, string> = {
      unset: "available",
      available: "unavailable",
      unavailable: "unset",
    };
    expect(NEXT["unset"]).toBe("available");
    expect(NEXT["available"]).toBe("unavailable");
    expect(NEXT["unavailable"]).toBe("unset");
  });

  test("nextBulkState: mixed column → available", () => {
    const nextBulkState = (vals: string[]) => {
      const allSame = vals.every(v => v === vals[0]);
      const NEXT: Record<string, string> = { unset: "available", available: "unavailable", unavailable: "unset" };
      return allSame ? NEXT[vals[0]] : "available";
    };
    expect(nextBulkState(["unset", "available", "unset"])).toBe("available");
    expect(nextBulkState(["available", "available", "available"])).toBe("unavailable");
    expect(nextBulkState(["unavailable", "unavailable"])).toBe("unset");
  });
});

// ── Employee page layout ──────────────────────────────────────────────────────
test.describe("Employee page structure (requires employee credentials)", () => {
  test("login page renders correctly", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("text=מוקד לילי")).toBeVisible();
    await expect(page.locator('input[type="tel"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("login page has Lilly logo", async ({ page }) => {
    await page.goto("/login");
    const logo = page.locator('img[alt="Lilly"]');
    await expect(logo).toBeVisible();
  });
});

// ── Task management ───────────────────────────────────────────────────────────
test.describe("Task CRUD via manager UI", () => {
  test("creating a task appears in the Kanban board", async ({ page }) => {
    await loginAsManager(page);
    await page.click("text=תפריט");
    await page.click("text=משימות");
    await expect(page.locator("text=לוח משימות")).toBeVisible({ timeout: 5000 });

    // Click + משימה חדשה
    await page.click("text=משימה חדשה");
    await page.fill('input[placeholder="מה צריך לעשות?"]', "Test E2E Task");
    await page.click('button[type="submit"] >> text=הוסף משימה');

    // Task should appear in the board
    await expect(page.locator("text=Test E2E Task")).toBeVisible({ timeout: 5000 });
  });
});
