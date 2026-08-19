import { test, expect } from "@playwright/test";
import { getServiceClient, seedTestCourse, createTestToken, cleanupE2EData } from "./helpers";

test.describe.serial("Token redemption", () => {
  let svc: ReturnType<typeof getServiceClient>;
  const userIds: string[] = [];
  const courseIds: string[] = [];
  const moduleIds: string[] = [];
  const lessonIds: string[] = [];
  const tokenIds: string[] = [];
  let username: string;
  const password = "E2eTokenPass123!";
  const rawToken = "E2E0-ABCD-EFGH-IJKL-MNOP-QRST";
  let id: string;

  test.beforeAll(async () => {
    svc = getServiceClient();
    id = `tk-${Date.now()}`;
    username = `tu-${id}`;

    // Create student user with correct email format for student login
    const email = `student-${username.toLowerCase()}@learnforless.local`;
    const { data: userData } = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    const userId = userData.user!.id;
    userIds.push(userId);

    await svc.from("profiles").upsert({
      id: userId,
      email,
      username,
      role: "student",
    });

    // Seed a course
    const course = await seedTestCourse(svc, id);
    courseIds.push(course.courseId);
    moduleIds.push(course.moduleId);
    lessonIds.push(course.lessonId);

    // Create token linked to the course
    const tokenId = await createTestToken(svc, rawToken, [course.courseId], userId);
    tokenIds.push(tokenId);
  });

  test.afterAll(async () => {
    await cleanupE2EData(svc, userIds, courseIds, moduleIds, lessonIds, tokenIds);
  });

  test("Redeem token and see course on dashboard", async ({ page }) => {
    // Login as the student
    await page.goto("/login");
    await page.fill("#username-input", username);
    await page.fill("#password-input", password);
    await page.click("button[type='submit']");
    await page.waitForURL(/\/dashboard$/);
    await expect(page.locator("h1")).toContainText("Your Courses");

    // Should see the redeem section
    await expect(page.getByText("Redeem access token")).toBeVisible();

    // Enter the token
    const tokenInput = page.locator("input[placeholder*='XXXX']");
    await tokenInput.fill(rawToken);

    // Click Redeem
    await page.click("button:has-text('Redeem')");

    // Wait for the page to refresh and the course card to appear
    await expect(page.getByText(`Test Course ${id}`)).toBeVisible({ timeout: 15000 });
  });
});