import { test, expect } from "@playwright/test";
test("production PWA installs its worker and never stores API responses", async ({
  page,
  request,
  context,
}) => {
  test.skip(
    process.env.EXPECT_PWA !== "true",
    "Run with EXPECT_PWA=true against npm run preview or a deployed production build.",
  );
  await page.goto("/");
  await expect(page.locator("main h1")).toBeVisible();
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.name).toContain("Nourish");
  expect(manifest.display).toBe("standalone");
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
  }
  await page.evaluate(async (apiBase) => {
    await navigator.serviceWorker.ready;
    const config = await (await fetch(`${apiBase}/config`)).json();
    for (const path of [
      "/appointments",
      `/availability?date=${config.today}`,
    ]) {
      const response = await fetch(apiBase + path);
      if (!response.ok)
        throw new Error(`PWA API probe failed: ${response.status}`);
    }
  }, process.env.E2E_API_URL || "http://127.0.0.1:8000/api");
  const cachedApi = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const entry of await cache.keys()) {
        if (new URL(entry.url).pathname.startsWith("/api/"))
          urls.push(entry.url);
      }
    }
    return urls;
  });
  expect(cachedApi).toEqual([]);
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "couldn’t reach the booking service",
  );
  await context.setOffline(false);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator("main h1")).toBeVisible();
});
