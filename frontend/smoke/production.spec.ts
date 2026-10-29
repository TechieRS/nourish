import { test, expect } from "@playwright/test";

test("deployed screens load their API data without browser errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const apiFailures: string[] = [];
  page.on("response", (response) => {
    if (
      new URL(response.url()).pathname.startsWith("/api/") &&
      response.status() >= 400
    )
      apiFailures.push(`${response.status()} ${response.url()}`);
  });
  for (const path of [
    "/",
    "/book",
    "/appointments",
    "/profile",
    "/nutritionist",
  ]) {
    await page.goto(path);
    await expect(page.locator("main h1")).toBeVisible({ timeout: 70000 });
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  }
  expect(apiFailures).toEqual([]);
  expect(errors).toEqual([]);
});
