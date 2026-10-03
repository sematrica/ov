import { test, expect, type Page } from "@playwright/test";
import fixture from "../fixtures/spacecraft.json";
import stage2 from "../fixtures/stage2-browser.json";
const record = fixture.records.find((r) => r.spacecraft.name === "Voyager 1")!;
const second = fixture.records.find((r) => r.spacecraft.name === "Voyager 2")!;
const cassini = fixture.records.find((r) => r.spacecraft.name === "Cassini")!;
const vectors = fixture.vectors as Record<
  string,
  (typeof fixture.vectors)["spacecraft:-31"]
>;
async function setup(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const counts = { lookup: 0, vectors: 0 };
  await page.route(/\/api\/trajectories(?:\?|$)/, (r) =>
    r.fulfill({
      json: {
        ...stage2.earth,
        range: vectors[record.spacecraft.id].range,
        objects: [vectors[record.spacecraft.id].earth],
      },
    }),
  );
  await page.route("**/api/planet?*", (r) =>
    r.fulfill({
      status: 503,
      json: { error: "Excluded from spacecraft fixture" },
    }),
  );
  await page.route("**/api/spacecraft/search?*", (r) => {
    counts.lookup++;
    const q = new URL(r.request().url()).searchParams.get("q")!;
    return r.fulfill({
      json: {
        results:
          q === "unknown"
            ? []
            : q === "Cassini"
              ? [cassini]
              : q === "-31"
                ? [record]
                : [record, second],
      },
    });
  });
  await page.route("**/api/spacecraft/trajectory?*", (r) => {
    counts.vectors++;
    const p = new URL(r.request().url()).searchParams;
    const id = p.get("id")!;
    if (id === "-82" && p.get("start") !== "2010-01-01")
      return r.fulfill({
        status: 502,
        json: { error: "Trajectory unavailable for selected date." },
      });
    return r.fulfill({ json: vectors[`spacecraft:${id}`] });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Spacecraft Explorer", exact: true })
    .click();
  return { errors, counts };
}
async function loadVoyager(page: Page) {
  await page
    .getByRole("button", { name: "Search Horizons", exact: true })
    .click();
  await expect(page.locator(".spacecraft-results button")).toHaveCount(2);
  await page
    .locator(".spacecraft-results button")
    .filter({ hasText: "Voyager 1" })
    .click();
  await page.getByLabel("Spacecraft start date").fill("2026-10-03");
  await page.getByLabel("Spacecraft end date").fill("2026-10-05");
  await page
    .locator(".spacecraft-choice")
    .getByRole("button", { name: "Add to visualization", exact: true })
    .click();
  await expect(
    page.getByLabel("Selected spacecraft information"),
  ).toBeVisible();
  await expect(page.locator(".spacecraft-drawer")).toHaveCount(0);
}
test("Voyager lookup, real vectors, cached loading, labels, layers, follow and deep link", async ({
  page,
}) => {
  const state = await setup(page);
  await loadVoyager(page);
  const panel = page.getByLabel("Selected spacecraft information");
  await expect(panel).toContainText(
    "Current modeled position from JPL Horizons",
  );
  await expect(panel).toContainText("Public telemetry feed not available.");
  await expect(panel).toContainText("1977-09-05");
  await expect(
    page
      .locator(".scene-labels")
      .getByRole("button", { name: "Voyager 1", exact: true }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Follow", exact: true }).click();
  await page
    .getByRole("button", { name: "Play simulation", exact: true })
    .click();
  await page.waitForTimeout(300);
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  expect(state.counts.vectors).toBe(1);
  await panel
    .getByRole("button", { name: "Hide trajectory", exact: true })
    .click();
  await expect(
    panel.getByRole("button", { name: "Show trajectory", exact: true }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Hide", exact: true }).click();
  await expect(
    page
      .locator(".scene-labels")
      .getByRole("button", { name: "Voyager 1", exact: true }),
  ).toHaveCount(0);
  await panel.getByRole("button", { name: "Show", exact: true }).click();
  await page.getByText("Layers", { exact: true }).click();
  await page.getByLabel("Spacecraft labels", { exact: true }).uncheck();
  await expect(
    page
      .locator(".scene-labels")
      .getByRole("button", { name: "Voyager 1", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Spacecraft labels", { exact: true }).check();
  await page.getByText("Layers", { exact: true }).click();
  await panel
    .getByRole("button", { name: "Load date range", exact: true })
    .click();
  await expect(page.locator(".spacecraft-choice h3")).toHaveText("Voyager 1");
  await page.getByLabel("Spacecraft start date").fill("2026-10-03");
  await page.getByLabel("Spacecraft end date").fill("2026-10-05");
  await page
    .locator(".spacecraft-choice")
    .getByRole("button", { name: "Add to visualization", exact: true })
    .click();
  await expect(page.locator(".spacecraft-drawer")).toHaveCount(0);
  expect(state.counts.vectors).toBe(1);
  await page.getByRole("button", { name: "Update link", exact: true }).click();
  await expect(page).toHaveURL(/object=spacecraft%3A-31/);
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await page.getByText("Camera", { exact: true }).click();
  await page
    .getByRole("button", { name: "Interstellar overview", exact: true })
    .click();
  await page.getByText("Camera", { exact: true }).click();
  await page.waitForTimeout(2300);
  await page.screenshot({ path: "/tmp/nearby-spacecraft-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/nearby-spacecraft-mobile.png",
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator(".spacecraft-panel")).toBeVisible();
  await expect(page.locator(".spacecraft-panel h2")).toHaveText("Voyager 1");
  await expect(page.locator(".spacecraft-panel")).toContainText(
    "Current modeled position from JPL Horizons",
  );
  expect(state.errors).toEqual([]);
});
test("historical mission failure, empty search and independent recovery", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Cassini", exact: true }).click();
  await page
    .locator(".spacecraft-results button")
    .filter({ hasText: "Cassini" })
    .click();
  await page.getByLabel("Spacecraft start date").fill("2026-10-03");
  await page.getByLabel("Spacecraft end date").fill("2026-10-05");
  await page
    .locator(".spacecraft-choice")
    .getByRole("button", { name: "Add to visualization", exact: true })
    .click();
  await expect(page.locator(".spacecraft-choice")).toContainText(
    "Trajectory unavailable for selected date.",
  );
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByLabel("Spacecraft start date").fill("2010-01-01");
  await page.getByLabel("Spacecraft end date").fill("2010-01-03");
  await page
    .locator(".spacecraft-choice")
    .getByRole("button", { name: "Add to visualization", exact: true })
    .click();
  await expect(page.locator(".spacecraft-drawer")).toHaveCount(0);
  await expect(
    page.getByLabel("Selected spacecraft information"),
  ).toContainText("2010-01-01");
  await page
    .getByRole("button", { name: "Spacecraft Explorer", exact: true })
    .click();
  await page.getByLabel("Search spacecraft", { exact: true }).fill("unknown");
  await page
    .getByRole("button", { name: "Search Horizons", exact: true })
    .click();
  await expect(
    page.getByText("No spacecraft found. Try a name, alias, or designation."),
  ).toBeVisible();
});
