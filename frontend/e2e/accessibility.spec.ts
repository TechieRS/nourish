import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.use({ serviceWorkers: "block" });

test("loading states remain accessible while the API is pending", async ({
  page,
}) => {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/clients", async (route) => {
    await waiting;
    await route.continue();
  });
  try {
    await page.goto("/");
    await expect(
      page.getByRole("status", { name: "Loading appointments" }),
    ).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  } finally {
    release();
  }
  await expect(page.locator("main h1").first()).toBeVisible();
});

test("primary screens have no automated WCAG A/AA violations", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/",
      "/book",
      "/appointments",
      "/profile",
      "/nutritionist",
    ]) {
      await page.goto(route);
      await expect(page.locator("main h1").first()).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        results.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            reason: n.failureSummary,
          })),
        })),
        `${route} at ${width}px: ${JSON.stringify(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })))}`,
      ).toEqual([]);
    }
  }
});
