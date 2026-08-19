import { test, expect } from "@playwright/test";
import { getServiceClient, createTestUser, seedTestCourse, cleanupTestData } from "./helpers";

test.describe.serial("Admin flows", () => {
  let svc: ReturnType<typeof getServiceClient>;
  const userIds: string[] = [];
  const courseIds: string[] = [];
  const moduleIds: string[] = [];
  const lessonIds: string[] = [];
  let adminEmail: string;
  const adminPassword = "E2eAdminPass123!";

  test.beforeAll(async () => {
    svc = getServiceClient();
    const id = `e2e-admin-${Date.now()}`;

    // Create admin user
    const admin = await createTestUser(svc, id, adminPassword, "admin");
    userIds.push(admin.id);
    adminEmail = admin.email;

    // Seed a published course for the courses list
    const course = await seedTestCourse(svc, id);
    courseIds.push(course.courseId);
    moduleIds.push(course.moduleId);
    lessonIds.push(course.lessonId);
  });

  test.afterAll(async () => {
    await cleanupTestData(svc, userIds, courseIds, moduleIds, lessonIds);
  });

  test("Admin login", async ({ page }) => {
    await page.goto("/admin/login");
    await page.fill("#email-input", adminEmail);
    await page.fill("#password-input", adminPassword);
    await page.click("button[type='submit']");

    // Wait for redirect to /admin/dashboard
    await page.waitForURL(/\/admin\/dashboard$/);
    await expect(page.locator("h1")).toContainText("Dashboard");
  });

  test("Admin dashboard shows metrics", async ({ page }) => {
    await page.goto("/admin/login");
    await page.fill("#email-input", adminEmail);
    await page.fill("#password-input", adminPassword);
    await page.click("button[type='submit']");
    await page.waitForURL(/\/admin\/dashboard$/);
    await expect(page.locator("h1")).toContainText("Dashboard");

    // Check metric cards are visible
    await expect(page.getByText("Courses").first()).toBeVisible();
    await expect(page.getByText("Modules").first()).toBeVisible();
    await expect(page.getByText("Lessons").first()).toBeVisible();
    await expect(page.getByText("Active Tokens").first()).toBeVisible();
    await expect(page.getByText("Students").first()).toBeVisible();
  });

  test("Admin courses list shows status badges", async ({ page }) => {
    await page.goto("/admin/login");
    await page.fill("#email-input", adminEmail);
    await page.fill("#password-input", adminPassword);
    await page.click("button[type='submit']");
    await page.waitForURL(/\/admin\/dashboard$/);
    await page.goto("/admin/courses");
    await expect(page.locator("h1")).toContainText("Courses");

    // Verify the published status badge is shown for the seeded course
    await expect(page.getByText("published").first()).toBeVisible();
  });
});