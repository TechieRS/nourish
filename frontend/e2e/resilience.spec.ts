import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { addDays, format, getDay, parseISO } from "date-fns";

// Fault injection must reach Playwright rather than the PWA's NetworkOnly worker.
test.use({ serviceWorkers: "block" });

const apiBase = process.env.E2E_API_URL || "http://127.0.0.1:8000/api";
async function chooseSlot(page: Page, request: APIRequestContext) {
  const config = await (await request.get(`${apiBase}/config`)).json();
  let date = addDays(parseISO(config.today), 4);
  if (getDay(date) === 0) date = addDays(date, 1);
  const day = format(date, "yyyy-MM-dd");
  await page.goto("/book");
  const dateButton = page.getByRole("button", {
    name: format(date, "EEEE, MMMM d, yyyy"),
    exact: true,
  });
  if (!(await dateButton.count()))
    await page.getByRole("button", { name: "Next month", exact: true }).click();
  await dateButton.click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const slot = page
    .getByRole("button", { name: /^\d{1,2}:\d{2} [AP]M$/ })
    .first();
  const label = await slot.textContent();
  await slot.click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  return { day, label };
}

test("an empty database allows the first client to book", async ({
  page,
  request,
}) => {
  await page.route("**/api/clients", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: [] })
      : route.continue(),
  );
  await page.goto("/appointments");
  await expect(
    page.getByText("Your next step toward better wellness starts here."),
  ).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  const { day } = await chooseSlot(page, request);
  await expect(page.getByLabel("Book for")).toHaveValue("new");
  await expect(page.getByLabel("Full name", { exact: true })).toBeEditable();
  const name = `First Client ${Date.now()}`;
  await page.getByLabel("Full name", { exact: true }).fill(name);
  await page
    .getByRole("button", { name: "Confirm booking", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "You’re booked, beautifully." }),
  ).toBeVisible();
  const clients = await (await request.get(`${apiBase}/clients`)).json();
  const client = clients.find(
    (c: { full_name: string }) => c.full_name === name,
  );
  const appointments = await (
    await request.get(`${apiBase}/appointments?client_id=${client.id}`)
  ).json();
  expect(appointments[0].appointment_date).toBe(day);
  await request.post(`${apiBase}/appointments/${appointments[0].id}/cancel`);
});

test("a slot lost during checkout returns to available times without a false success", async ({
  page,
  request,
}) => {
  const client = await (
    await request.post(`${apiBase}/clients`, {
      data: { full_name: `Conflict Demo ${Date.now()}` },
    })
  ).json();
  await page.goto("/");
  await page.getByLabel("Demo client", { exact: true }).selectOption(client.id);
  const { day, label } = await chooseSlot(page, request);
  const [_, hour, minute, period] = label!.match(/(\d+):(\d+) (AM|PM)/)!;
  const time = `${String((Number(hour) % 12) + (period === "PM" ? 12 : 0)).padStart(2, "0")}:${minute}:00`;
  const winner = await request.post(`${apiBase}/appointments`, {
    data: { client_id: client.id, appointment_date: day, start_time: time },
  });
  expect(winner.status()).toBe(201);
  const id = (await winner.json()).id;
  try {
    await page
      .getByRole("button", { name: "Confirm booking", exact: true })
      .click();
    await expect(
      page.getByText("That time was just booked. Please choose another slot."),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Your moment of care" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: label!, exact: true }),
    ).toHaveCount(0);
    const list = await (
      await request.get(`${apiBase}/appointments?client_id=${client.id}`)
    ).json();
    expect(list).toHaveLength(1);
  } finally {
    await request.post(`${apiBase}/appointments/${id}/cancel`);
  }
});

test("API outage has a readable error and recovers with retry", async ({
  page,
}) => {
  await page.route("**/api/clients", (route) =>
    route.fulfill({
      status: 503,
      json: {
        detail:
          "Our booking service is temporarily unavailable. Please try again shortly.",
      },
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await page.unroute("**/api/clients");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator("main h1")).toBeVisible();
});

test("mobile booking, calendar export and cancellation preserve keyboard focus", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const client = await (
    await request.post(`${apiBase}/clients`, {
      data: { full_name: `Keyboard Demo ${Date.now()}` },
    })
  ).json();
  await page.goto("/");
  await page.getByLabel("Demo client", { exact: true }).selectOption(client.id);
  await chooseSlot(page, request);
  await page
    .getByRole("button", { name: "Confirm booking", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "You’re booked, beautifully." }),
  ).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Add to calendar" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("nourish-consultation.ics");
  const stream = await download.createReadStream();
  let calendar = "";
  for await (const chunk of stream!) calendar += chunk.toString();
  expect(calendar).toContain("DTSTART;TZID=Asia/Kolkata:");
  expect(calendar).toContain("BEGIN:VEVENT");
  await page.goto("/appointments");
  const cancel = page.getByRole("button", { name: "Cancel", exact: true });
  await cancel.click();
  await expect(
    page.getByRole("button", { name: "Keep appointment" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).not.toBeVisible();
  await expect(cancel).toBeFocused();
  const list = await (
    await request.get(`${apiBase}/appointments?client_id=${client.id}`)
  ).json();
  await request.post(`${apiBase}/appointments/${list[0].id}/cancel`);
});

test("desktop and mobile screenshots of loaded screens", async ({
  page,
}, info) => {
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
      await expect(page.locator("main h1")).toBeVisible();
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      await page.screenshot({
        path: info.outputPath(`${route.slice(1) || "home"}-${width}.png`),
        fullPage: true,
      });
    }
  }
});
