import { test, expect } from "@playwright/test";
test("production PWA installs its worker and never stores API responses", async ({
  page,
  request,
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
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    await fetch("/api/appointments");
    await fetch("/api/availability?date=2026-10-29");
  });
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
});
