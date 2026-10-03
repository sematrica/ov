import { test, expect, type Page } from "@playwright/test";
import fixture from "../fixtures/stage2-browser.json";
import encounter from "../fixtures/encounter.json";
import planets from "../fixtures/planets.json";
const event = {
  id: `${encounter.neo.id}:${encounter.approach.time}:Earth`,
  object: encounter.neo,
  approach: encounter.approach,
  discoveryDate: "2026-09-26",
};
async function routes(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const calls = { encounters: [] as string[], planets: 0 };
  await page.route(/\/api\/trajectories(?:\?|$)/, (r) =>
    r.fulfill({ json: fixture.earth }),
  );
  await page.route("**/api/planet?*", (r) => {
    calls.planets++;
    const id = new URL(r.request().url()).searchParams.get(
      "id",
    ) as keyof typeof planets;
    return r.fulfill({ json: planets[id] });
  });
  await page.route("**/api/events?*", (r) =>
    r.fulfill({ json: { events: [event], failures: [] } }),
  );
  await page.route("**/api/encounter?*", (r) => {
    calls.encounters.push(r.request().url());
    return r.fulfill({ json: encounter });
  });
  return { calls, errors };
}
test("planet search, layers, event browsing, exact jump and deep-link restoration", async ({
  page,
}) => {
  const state = await routes(page);
  await page.goto("/");
  await page.getByText("Data status", { exact: true }).click();
  await expect(page.getByText("Saturn: Loaded", { exact: true })).toBeVisible();
  await page.getByText("Data status", { exact: true }).click();
  expect(state.calls.planets).toBe(6);
  await page.getByText("Search objects", { exact: true }).click();
  await page.getByLabel("Search objects", { exact: true }).fill("Jupiter");
  await page
    .locator(".search-results")
    .getByRole("button", { name: "Jupiter", exact: true })
    .click();
  await expect(
    page.locator(".object-panel").getByRole("heading", { name: "Jupiter" }),
  ).toBeVisible();
  await page.getByText("Search objects", { exact: true }).click();
  await page.getByText("Layers", { exact: true }).click();
  await page.getByLabel("Planet orbits", { exact: true }).uncheck();
  await page.getByLabel("Labels", { exact: true }).uncheck();
  await expect(page.locator(".scene-labels")).toHaveCount(0);
  await page.getByLabel("Labels", { exact: true }).check();
  await page.getByText("Layers", { exact: true }).click();
  await page
    .getByRole("button", { name: "Event Explorer", exact: true })
    .click();
  await page.getByLabel("Event start date").fill("2026-09-26");
  await page.getByLabel("Event end date").fill("2026-09-26");
  await page
    .getByRole("button", { name: "Browse events", exact: true })
    .click();
  await expect(page.locator(".event-row")).toHaveCount(1);
  await page
    .getByRole("button", { name: "View Encounter", exact: true })
    .click();
  await expect(page.getByLabel("Earth encounter telemetry")).toBeVisible();
  expect(new URL(state.calls.encounters[0]).searchParams.get("time")).toBe(
    String(event.approach.time),
  );
  await expect(page).toHaveURL(/mode=encounter/);
  await page.reload();
  await expect(page.getByLabel("Earth encounter telemetry")).toBeVisible();
  await page.getByRole("button", { name: "SOLAR SYSTEM", exact: true }).click();
  await page
    .getByRole("button", { name: "Event Explorer", exact: true })
    .click();
  await page.getByLabel("Event start date").fill("2026-09-26");
  await page.getByLabel("Event end date").fill("2026-09-26");
  await page
    .getByRole("button", { name: "Browse events", exact: true })
    .click();
  await page
    .getByRole("button", { name: "View in Solar System", exact: true })
    .click();
  await expect(
    page.getByRole("slider", { name: "Simulation timeline" }),
  ).toHaveValue(String(event.approach.time));
  await expect(
    page.getByRole("button", { name: "Selected event on timeline" }),
  ).toBeVisible();
  expect(state.errors).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/nearby-stage4-mobile.png",
    fullPage: true,
  });
});
test("partial event failures keep results and a failed planet does not block Earth", async ({
  page,
}) => {
  await routes(page);
  await page.route("**/api/planet?*", (r) =>
    r.fulfill({ status: 502, json: { error: "Planet unavailable" } }),
  );
  await page.route("**/api/events?*", (r) =>
    r.fulfill({
      json: {
        events: [event],
        failures: [
          {
            window: { start: "2026-09-27", end: "2026-10-03" },
            error: "NASA unavailable",
          },
        ],
      },
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Event Explorer", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Browse events", exact: true })
    .click();
  await expect(page.locator(".event-row")).toHaveCount(1);
  await expect(
    page.getByText("Partial results — 1 windows failed"),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "/tmp/nearby-stage4-desktop.png" });
});
