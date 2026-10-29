import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { addDays, format, getDay, parseISO } from "date-fns";
const apiBase = process.env.E2E_API_URL || "http://127.0.0.1:8000/api";
async function nextDay(request: APIRequestContext) {
  const config = await (await request.get(`${apiBase}/config`)).json();
  let day = addDays(parseISO(config.today), 2);
  if (getDay(day) === 0) day = addDays(day, 1);
  return format(day, "yyyy-MM-dd");
}
async function chooseDay(page: Page, day: string) {
  await expect(
    page.getByRole("heading", { name: "A day that works for you" }),
  ).toBeVisible();
  const button = page.getByRole("button", {
    name: format(parseISO(day), "EEEE, MMMM d, yyyy"),
    exact: true,
  });
  if (!(await button.count()))
    await page.getByRole("button", { name: "Next month", exact: true }).click();
  await expect(button).toBeVisible();
  await button.click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}
test("booking, dashboard sync, status, reschedule, conflict, confirmation, cancellation and refresh", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const client = await (
    await request.post(`${apiBase}/clients`, {
      data: { full_name: `Browser Demo ${Date.now()}`, phone: null },
    })
  ).json();
  const day = await nextDay(request);
  const slots = await (
    await request.get(`${apiBase}/availability?date=${day}`)
  ).json();
  expect(slots.slots.length).toBeGreaterThan(2);
  let savedId = "";
  try {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ }),
    ).toBeVisible();
    await page
      .getByLabel("Demo client", { exact: true })
      .selectOption(client.id);
    await page.goto("/book");
    await chooseDay(page, day);
    const slot = slots.slots[0];
    const [h, m] = slot.split(":").map(Number);
    const label = `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
      client.full_name,
    );
    await page
      .getByRole("button", { name: "Confirm booking", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "You’re booked, beautifully." }),
    ).toBeVisible();
    let list = await (
      await request.get(`${apiBase}/appointments?client_id=${client.id}`)
    ).json();
    savedId = list[0].id;
    await page.goto("/nutritionist");
    await page
      .getByRole("textbox", { name: "Search clients" })
      .fill(client.full_name);
    await expect(
      page.locator("main").getByText(client.full_name, { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: /Status for/ })
      .selectOption("Done");
    await expect(
      page.getByRole("combobox", { name: /Status for/ }),
    ).toHaveValue("Done");
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(
      page.getByText("Awaiting confirmation", { exact: true }),
    ).toHaveCount(0);
    await page.goto("/appointments");
    await expect(page.getByText("Done", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Done", { exact: true })).toBeVisible();
    // A separate eligible booking exercises reschedule, preserving the terminal record.
    const created = await request.post(`${apiBase}/appointments`, {
      data: {
        client_id: client.id,
        appointment_date: day,
        start_time: slots.slots[1],
      },
    });
    expect(created.status()).toBe(201);
    savedId = (await created.json()).id;
    await page.goto(`/book?reschedule=${savedId}`);
    await chooseDay(page, day);
    const nextSlot = slots.slots[2];
    const [nh, nm] = nextSlot.split(":").map(Number);
    await page
      .getByRole("button", {
        name: `${nh % 12 || 12}:${String(nm).padStart(2, "0")} ${nh >= 12 ? "PM" : "AM"}`,
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Confirm new time" }).click();
    await expect(
      page.getByRole("heading", { name: "Your new time is saved." }),
    ).toBeVisible();
    const available = await (
      await request.get(`${apiBase}/availability?date=${day}`)
    ).json();
    expect(available.slots).toContain(slots.slots[1]);
    expect(available.slots).not.toContain(nextSlot);
    const duplicate = await request.post(`${apiBase}/appointments`, {
      data: {
        client_id: client.id,
        appointment_date: day,
        start_time: nextSlot,
      },
    });
    expect(duplicate.status()).toBe(409);
    await page.goto("/appointments");
    await page.getByRole("button", { name: "I’ll be there" }).click();
    await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Keep appointment" }).click();
    await expect(dialog).not.toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Cancel appointment", exact: true })
      .click();
    await expect(page.getByRole("alertdialog")).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Cancel", exact: true }),
    ).toHaveCount(0);
    expect(
      (await (await request.get(`${apiBase}/availability?date=${day}`)).json())
        .slots,
    ).toContain(nextSlot);
    expect(errors).toEqual([]);
  } finally {
    if (savedId)
      await request.post(`${apiBase}/appointments/${savedId}/cancel`);
  }
});
test("all screens fit every required viewport without horizontal overflow", async ({
  page,
}) => {
  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/",
      "/book",
      "/appointments",
      "/profile",
      "/nutritionist",
    ]) {
      await page.goto(route);
      await expect(page.locator("main h1, main h2").first()).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} at ${width}px`,
      ).toBe(true);
    }
  }
});
test("creates a new fictional client through the booking form", async ({
  page,
  request,
}) => {
  const day = await nextDay(request);
  const name = `New Profile ${Date.now()}`;
  await page.goto("/book");
  await chooseDay(page, day);
  await page
    .getByRole("button", { name: /^\d{1,2}:\d{2} [AP]M$/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Book for").selectOption("new");
  await page
    .getByRole("button", { name: "Confirm booking", exact: true })
    .click();
  await expect(page.getByText("Please enter your full name.")).toBeVisible();
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
  expect(client.phone).toBeNull();
  const list = await (
    await request.get(`${apiBase}/appointments?client_id=${client.id}`)
  ).json();
  expect(list).toHaveLength(1);
  await request.post(`${apiBase}/appointments/${list[0].id}/cancel`);
});
test("nutritionist manually adds a consultation using live availability", async ({
  page,
  request,
}) => {
  const day = await nextDay(request),
    name = `Practitioner Demo ${Date.now()}`;
  const client = await (
    await request.post(`${apiBase}/clients`, {
      data: { full_name: name, phone: "(202) 555-0123" },
    })
  ).json();
  await page.goto("/nutritionist");
  await page.getByRole("link", { name: "Add appointment" }).click();
  await chooseDay(page, day);
  await page
    .getByRole("button", { name: /^\d{1,2}:\d{2} [AP]M$/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Book for").selectOption(client.id);
  await page
    .getByRole("button", { name: "Confirm booking", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "You’re booked, beautifully." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Return to dashboard" }).click();
  await page.getByRole("textbox", { name: "Search clients" }).fill(name);
  await expect(
    page.locator("main").getByText(name, { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Demo client", { exact: true }).selectOption(client.id);
  await page.goto("/appointments");
  await expect(
    page.getByRole("heading", { name: "Nutrition consultation" }),
  ).toBeVisible();
  const list = await (
    await request.get(`${apiBase}/appointments?client_id=${client.id}`)
  ).json();
  await request.post(`${apiBase}/appointments/${list[0].id}/cancel`);
});
