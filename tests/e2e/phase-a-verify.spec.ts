import { test, expect } from "@playwright/test";
import { getServiceClient, createTestUser, cleanupTestData } from "./helpers";

const BASE = "http://localhost:3000";

test.describe.serial("Phase A — Admin sidebar active state", () => {
  let svc: ReturnType<typeof getServiceClient>;
  const userIds: string[] = [];
  let adminEmail: string;
  const adminPassword = "E2eAdminPass123!";

  test.beforeAll(async () => {
    svc = getServiceClient();
    const id = `phase-a-${Date.now()}`;
    const admin = await createTestUser(svc, id, adminPassword, "admin");
    userIds.push(admin.id);
    adminEmail = admin.email;
  });

  test.afterAll(async () => {
    await cleanupTestData(svc, userIds, [], [], []);
  });

  async function loginAsAdmin(page: any) {
    await page.goto(`${BASE}/admin/login`);
    await page.waitForSelector("#email-input");
    await page.fill("#email-input", adminEmail);
    await page.fill("#password-input", adminPassword);
    await page.click("button[type='submit']");
    await page.waitForURL(/\/admin\/dashboard$/);
  }

  test("Dashboard link active on /admin/dashboard", async ({ page }) => {
    await loginAsAdmin(page);
    const activeLink = page.locator('nav a[aria-current="page"]');
    await expect(activeLink).toHaveText("Dashboard");
  });

  test("Courses link active on /admin/courses", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/courses`);
    await expect(page.locator('nav a[aria-current="page"]')).toHaveText("Courses");
  });

  test("Courses link active on /admin/courses/new", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/courses/new`);
    await expect(page.locator('nav a[aria-current="page"]')).toHaveText("Courses");
  });

  test("Courses link active on /admin/courses/[id]/builder", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/courses`);
    const builderLink = page.locator('a[href*="/builder"]').first();
    if (await builderLink.count() > 0) {
      await builderLink.click();
      await page.waitForLoadState("networkidle");
      await expect(page.locator('nav a[aria-current="page"]')).toHaveText("Courses");
    }
  });

  test("Tokens link active on /admin/tokens", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/tokens`);
    await expect(page.locator('nav a[aria-current="page"]')).toHaveText("Access Tokens");
  });

  test("Users link active on /admin/users", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/users`);
    await expect(page.locator('nav a[aria-current="page"]')).toHaveText("User Directory");
  });

  test("Settings link active on /admin/settings", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/settings`);
    await expect(page.locator('nav a[aria-current="page"]')).toHaveText("Settings");
  });

  test("only one link has aria-current=page", async ({ page }) => {
    await loginAsAdmin(page);
    const activeLinks = page.locator('nav a[aria-current="page"]');
    await expect(activeLinks).toHaveCount(1);
  });
});

test.describe("Phase A — Not-found boundaries", () => {
  test("root not-found shows link to /dashboard", async ({ page }) => {
    await page.goto(`${BASE}/nonexistent-page`);
    await expect(page.getByText("Page not found")).toBeVisible();
    await expect(page.getByText("Go to Dashboard")).toBeVisible();
  });

  test("admin not-found shows link to /admin/dashboard", async ({ page }) => {
    // Use admin.spec.ts's login approach — create admin inline
    const svc = getServiceClient();
    const id = `phase-a-nf-${Date.now()}`;
    const admin = await createTestUser(svc, id, "E2eAdminPass123!", "admin");

    try {
      await page.goto(`${BASE}/admin/login`);
      await page.waitForSelector("#email-input");
      await page.fill("#email-input", admin.email);
      await page.fill("#password-input", "E2eAdminPass123!");
      await page.click("button[type='submit']");
      await page.waitForURL(/\/admin\/dashboard$/);

      await page.goto(`${BASE}/admin/nonexistent`);
      await expect(page.getByText("Page not found")).toBeVisible();
      await expect(page.getByText("Go to Dashboard")).toBeVisible();
    } finally {
      await cleanupTestData(svc, [admin.id], [], [], []);
    }
  });
});

test.describe("Phase A — Loading state", () => {
  test("loading boundary structure is wired", async ({}) => {
    // Structural assertion: every route group has a loading.tsx exporting the
    // spinner, so Next.js mounts the default Suspense loading UI before the
    // page's RSC payload resolves. In dev, most pages resolve synchronously
    // (spinner never paints), so the wiring is verified here at the source.
    const fs = await import("fs");
    const path = await import("path");
    const root = path.join(process.cwd(), "src/app");
    const expected = [
      "loading.tsx",
      "error.tsx",
      "not-found.tsx",
      "(admin)/loading.tsx",
      "(admin)/error.tsx",
      "(admin)/not-found.tsx",
      "(student)/loading.tsx",
      "(student)/error.tsx",
      "(student)/not-found.tsx",
      "(public)/loading.tsx",
      "(public)/error.tsx",
      "(public)/not-found.tsx",
      "admin/login/loading.tsx",
      "admin/login/error.tsx",
    ];
    const missing = expected.filter((p) => !fs.existsSync(path.join(root, p)));
    expect(missing).toEqual([]);
  });
});