import { test, expect } from "@playwright/test";
import { getServiceClient, cleanupTestData } from "./helpers";

test.describe.serial("Auth flows", () => {
  let svc: ReturnType<typeof getServiceClient>;
  const userIds: string[] = [];
  let username: string;
  const password = "E2eAuthPass123!";

  test.beforeAll(() => {
    svc = getServiceClient();
  });

  test.afterAll(async () => {
    if (userIds.length > 0) {
      await cleanupTestData(svc, userIds, [], [], []);
    }
  });

  test("Register a new student account", async ({ page }) => {
    const id = `e2e-auth-${Date.now()}`;
    username = `e2euser-${id}`;

    await page.goto("/register");
    await page.fill("#username-input", username);
    await page.fill("#password-input", password);
    await page.fill("#confirm-input", password);
    await page.click("button[type='submit']");

    // Wait for redirect to /login after successful registration
    await page.waitForURL(/\/login$/);

    // Capture user ID for cleanup
    const email = `student-${username.toLowerCase()}@learnforless.local`;
    const { data } = await svc.from("profiles").select("id").eq("email", email).single();
    if (data) {
      userIds.push(data.id);
    }
  });

  test("Login with registered student", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#username-input", username);
    await page.fill("#password-input", password);
    await page.click("button[type='submit']");

    // Wait for redirect to /dashboard
    await page.waitForURL(/\/dashboard$/);
    await expect(page.locator("h1")).toContainText("Your Courses");
  });

  test("Empty dashboard shows redeem section", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#username-input", username);
    await page.fill("#password-input", password);
    await page.click("button[type='submit']");

    // Wait for redirect to /dashboard
    await expect(page.locator("h1")).toContainText("Your Courses", { timeout: 15000 });
    await expect(page.getByText("Redeem access token")).toBeVisible();
  });
});