import { test, expect } from "@playwright/test";
import { getServiceClient, seedMultiLessonCourse, assignStudentToCourse, cleanupE2EData } from "./helpers";

test.describe.serial("Student courses", () => {
  let svc: ReturnType<typeof getServiceClient>;
  const userIds: string[] = [];
  const courseIds: string[] = [];
  const moduleIds: string[] = [];
  const lessonIds: string[] = [];
  let username: string;
  const password = "E2eCoursePass123!";
  let id: string;
  let courseId: string;

  test.beforeAll(async () => {
    svc = getServiceClient();
    id = `ec-${Date.now()}`;
    username = `cu-${id}`;

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

    // Seed a course with 3 text lessons
    const course = await seedMultiLessonCourse(svc, id, 3);
    courseId = course.courseId;
    courseIds.push(course.courseId);
    moduleIds.push(course.moduleId);
    lessonIds.push(...course.lessonIds);

    // Update third lesson to be a link type
    await svc
      .from("lessons")
      .update({ content_type: "link", content: "https://example.com" })
      .eq("id", course.lessonIds[2]);

    // Assign student to course
    await assignStudentToCourse(svc, userId, course.courseId);
  });

  test.afterAll(async () => {
    await cleanupE2EData(svc, userIds, courseIds, moduleIds, lessonIds, []);
  });

  test("Course overview shows modules and lessons", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#username-input", username);
    await page.fill("#password-input", password);
    await page.click("button[type='submit']");
    await page.waitForURL(/\/dashboard$/);

    // Navigate directly to course overview
    await page.goto(`/course/${courseId}`);
    await page.waitForURL(/\/course\//);

    // Verify course overview elements
    await expect(page.locator("h1")).toContainText(`E2E Course ${id}`);
    await expect(page.getByText(`E2E Module ${id}`)).toBeVisible();
  });

  test("Lesson page shows content and mark complete", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.fill("#username-input", username);
    await page.fill("#password-input", password);
    await page.click("button[type='submit']");
    await page.waitForURL(/\/dashboard$/);

    // Navigate to first lesson
    const lesson1Title = `E2E Lesson ${id} 1`;
    await page.goto(`/course/${courseId}/lesson/${lessonIds[0]}`);
    await page.waitForURL(/\/lesson\//);

    // Verify lesson title
    await expect(page.locator("h1")).toContainText(lesson1Title);

    // Click "Mark as Complete"
    await page.click("button:has-text('Mark as Complete')");

    // Verify "Lesson Completed" indicator appears
    await expect(page.getByText("Lesson Completed")).toBeVisible({ timeout: 10000 });
  });

  test("Link lesson shows Visit Resource button", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.fill("#username-input", username);
    await page.fill("#password-input", password);
    await page.click("button[type='submit']");
    await page.waitForURL(/\/dashboard$/);

    // Navigate to third lesson (link type)
    await page.goto(`/course/${courseId}/lesson/${lessonIds[2]}`);
    await page.waitForURL(/\/lesson\//);

    // Verify "Visit Resource" button is visible and has the correct href
    const visitBtn = page.locator("a[href='https://example.com']");
    await expect(visitBtn).toBeVisible();
    await expect(visitBtn).toHaveAttribute("target", "_blank");
  });

  test("Prev/Next navigation works", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.fill("#username-input", username);
    await page.fill("#password-input", password);
    await page.click("button[type='submit']");
    await page.waitForURL(/\/dashboard$/);

    // Navigate to first lesson
    await page.goto(`/course/${courseId}/lesson/${lessonIds[0]}`);
    await page.waitForURL(/\/lesson\//);
    await expect(page.locator("h1")).toContainText(`E2E Lesson ${id} 1`);

    // Click "Next" — should go to lesson 2
    await page.click("button:has-text('Next')");
    await page.waitForURL(/\/lesson\//);
    await expect(page.locator("h1")).toContainText(`E2E Lesson ${id} 2`);

    // Click "Previous" — should go back to lesson 1
    await page.click("button:has-text('Previous')");
    await page.waitForURL(/\/lesson\//);
    await expect(page.locator("h1")).toContainText(`E2E Lesson ${id} 1`);
  });
});