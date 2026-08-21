import { test, expect } from "@playwright/test";
import { getServiceClient, createTestUser, seedTestCourse, cleanupTestData } from "./helpers";

test.describe.serial("Lesson editor visual check", () => {
  let svc: ReturnType<typeof getServiceClient>;
  const userIds: string[] = [];
  const courseIds: string[] = [];
  const moduleIds: string[] = [];
  const lessonIds: string[] = [];
  let adminEmail: string;
  let courseId: string;
  const adminPassword = "E2eAdminPass123!";

  test.beforeAll(async () => {
    svc = getServiceClient();
    const id = `e2e-visual-${Date.now()}`;

    const admin = await createTestUser(svc, id, adminPassword, "admin");
    userIds.push(admin.id);
    adminEmail = admin.email;

    const course = await seedTestCourse(svc, id);
    courseIds.push(course.courseId);
    moduleIds.push(course.moduleId);
    lessonIds.push(course.lessonId);
    courseId = course.courseId;
  });

  test.afterAll(async () => {
    await cleanupTestData(svc, userIds, courseIds, moduleIds, lessonIds);
  });

  async function login(page: import("@playwright/test").Page) {
    await page.goto("/admin/login");
    await page.fill("#email-input", adminEmail);
    await page.fill("#password-input", adminPassword);
    await page.click("button[type='submit']");
    await page.waitForURL(/\/admin\/dashboard$/);
    await page.goto(`/admin/courses/${courseId}/builder`);
    await expect(page.locator("h1").first()).toBeVisible();
  }

  test("New lesson editor desktop", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: /Add Lesson/i }).first().click();
    await expect(page.getByText("New Lesson")).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "browser-qa-screenshots/lesson-editor-new-desktop.png", fullPage: true });
  });

  test("Edit lesson editor desktop", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: /Edit Lesson/i }).first().click();
    await expect(page.getByText("Edit Lesson")).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "browser-qa-screenshots/lesson-editor-edit-desktop.png", fullPage: true });
  });

  test("New lesson editor mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.getByRole("button", { name: /Add Lesson/i }).first().click();
    await expect(page.getByText("New Lesson")).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "browser-qa-screenshots/lesson-editor-new-mobile.png", fullPage: true });
  });
});
