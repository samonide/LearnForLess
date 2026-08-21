import { test, expect } from "@playwright/test";
import {
  getServiceClient,
  createTestUser,
  seedTestCourse,
  assignStudentToCourse,
  cleanupTestData,
} from "./helpers";

test.describe.serial("View Access panel visual check", () => {
  let svc: ReturnType<typeof getServiceClient>;
  const userIds: string[] = [];
  const courseIds: string[] = [];
  const moduleIds: string[] = [];
  const lessonIds: string[] = [];
  let adminEmail: string;
  let studentId: string;
  let courseId: string;
  const adminPassword = "E2eAdminPass123!";

  test.beforeAll(async () => {
    svc = getServiceClient();
    const id = `e2e-access-${Date.now()}`;

    const admin = await createTestUser(svc, id, adminPassword, "admin");
    userIds.push(admin.id);
    adminEmail = admin.email;

    const student = await createTestUser(svc, `${id}-stu`, "E2eStudentPass123!", "student");
    userIds.push(student.id);
    studentId = student.id;

    const course = await seedTestCourse(svc, id);
    courseIds.push(course.courseId);
    moduleIds.push(course.moduleId);
    lessonIds.push(course.lessonId);
    courseId = course.courseId;

    // Give the student one active membership so the panel shows a real row
    await assignStudentToCourse(svc, student.id, course.courseId);
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
    await page.goto("/admin/users");
    await expect(page.locator("h1").first()).toContainText("Users");
  }

  async function openPanel(page: import("@playwright/test").Page) {
    await login(page);
    await page.getByRole("button", { name: /View Access/i }).first().click();
    await expect(page.getByText("Access Profiles")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Active Courses/ })).toBeVisible();
    await page.waitForTimeout(500);
  }

  test("View Access desktop", async ({ page }) => {
    await openPanel(page);
    await page.screenshot({
      path: "browser-qa-screenshots/view-access-desktop.png",
      fullPage: true,
    });
    await expect(page.getByRole("button", { name: "Revoke" }).first()).toBeVisible();
  });

  test("View Access mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openPanel(page);
    await page.screenshot({
      path: "browser-qa-screenshots/view-access-mobile.png",
      fullPage: true,
    });
  });

  test("Revoke confirmation dialog", async ({ page }) => {
    await openPanel(page);
    await page.getByRole("button", { name: "Revoke" }).first().click();
    await expect(page.getByText("Revoke course access?")).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: "browser-qa-screenshots/view-access-revoke-confirm.png",
      fullPage: true,
    });
    // Cancel must close without revoking
    await page.getByRole("button", { name: "Cancel" }).first().click();
    await expect(page.getByText("Revoke course access?")).not.toBeVisible();
  });
});
