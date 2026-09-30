import { test, expect, type Page } from "@playwright/test";
import fixture from "../fixtures/stage2-browser.json";
const trajectories: Record<string, unknown> = fixture.trajectories;
const defaultNeo = fixture.discovery.objects.find(
  (neo) => neo.name === "(2008 ST)",
)!;
async function setup(page: Page, failOne = false) {
  const requests = { discovery: 0, trajectories: [] as string[] };
  await page.route("**/api/trajectories", (route) =>
    route.fulfill({ json: fixture.earth }),
  );
  await page.route("**/api/discovery?*", (route) => {
    requests.discovery++;
    return route.fulfill({ json: fixture.discovery });
  });
  await page.route("**/api/neo-trajectory?*", (route) => {
    const id = new URL(route.request().url()).searchParams.get("id")!;
    requests.trajectories.push(id);
    return failOne && id === defaultNeo.id
      ? route.fulfill({
          status: 502,
          json: { error: "Horizons could not find this asteroid." },
        })
      : route.fulfill({ json: trajectories[id] });
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Load NEOs for", exact: false }),
  ).toBeVisible();
  return requests;
}
test("discovery is explicit; only three trajectories load; selection, visibility and cache work", async ({
  page,
}) => {
  const requests = await setup(page);
  expect(requests.discovery).toBe(0);
  await page.getByLabel("Discovery date (UTC)").fill("2026-09-27");
  await page.getByRole("button", { name: "Load NEOs for 2026-09-27" }).click();
  await expect(
    page.locator(".neo-row .neo-state", { hasText: "LOADED" }),
  ).toHaveCount(3);
  expect(requests.discovery).toBe(1);
  expect(new Set(requests.trajectories).size).toBe(3);
  const name = defaultNeo.name;
  const row = page.locator(".neo-row").filter({ hasText: name });
  await page.locator(".neo-name").filter({ hasText: name }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.getByLabel("NASA close approach metadata")).toBeVisible();
  await row.getByRole("button", { name: `Hide ${name}`, exact: true }).click();
  await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
  await row.getByRole("button", { name: `Show ${name}`, exact: true }).click();
  await row.getByRole("button", { name: "Remove", exact: true }).click();
  await page
    .locator(".neo-row")
    .filter({ hasText: name })
    .getByRole("button", { name: "Add to visualization" })
    .click();
  await expect(
    page.locator(".neo-row .neo-state", { hasText: "LOADED" }),
  ).toHaveCount(3);
  expect(requests.trajectories).toHaveLength(3);
  await page.getByRole("button", { name: "Load NEOs for 2026-09-27" }).click();
  expect(requests.discovery).toBe(1);
  await page
    .getByRole("slider", { name: "Simulation timeline" })
    .fill(String(fixture.earth.range.start + 3600_000));
  await page.getByRole("button", { name: "Play simulation" }).click();
  await expect(
    page.getByRole("button", { name: "Pause simulation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause simulation" }).click();
  expect(requests.discovery).toBe(1);
  expect(requests.trajectories).toHaveLength(3);
});
test("one failed asteroid does not prevent other trajectories loading", async ({
  page,
}) => {
  await setup(page, true);
  await page.getByLabel("Discovery date (UTC)").fill("2026-09-27");
  await page.getByRole("button", { name: "Load NEOs for 2026-09-27" }).click();
  await expect(
    page.locator(".neo-row .neo-state", { hasText: "LOADED" }),
  ).toHaveCount(2);
  await expect(
    page.getByText("Horizons could not find this asteroid.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Earth", exact: true }).first(),
  ).toBeEnabled();
});
test("a late discovery response cannot overwrite a newer requested date", async ({
  page,
}) => {
  await setup(page);
  let releaseOld: (() => void) | undefined;
  const oldGate = new Promise<void>((resolve) => {
    releaseOld = resolve;
  });
  await page.route("**/api/discovery?*", async (route) => {
    const date = new URL(route.request().url()).searchParams.get("date")!;
    if (date === "2026-09-27") await oldGate;
    await route.fulfill({
      json: {
        ...fixture.discovery,
        date,
        window: { start: date, end: date },
        objects: [],
      },
    });
  });
  await page.getByLabel("Discovery date (UTC)").fill("2026-09-27");
  await page.getByRole("button", { name: "Load NEOs for 2026-09-27" }).click();
  await page.getByLabel("Discovery date (UTC)").fill("2026-09-28");
  await page.getByRole("button", { name: "Load NEOs for 2026-09-28" }).click();
  await expect(page.locator(".discovery-window")).toContainText(
    "2026-09-28 — 2026-09-28",
  );
  const oldResponse = page.waitForResponse((response) =>
    response.url().includes("/api/discovery?date=2026-09-27"),
  );
  releaseOld!();
  await oldResponse;
  await expect(
    page.getByText("No Earth approaches returned for this window."),
  ).toBeVisible();
  await expect(page.locator(".discovery-window")).toContainText(
    "2026-09-28 — 2026-09-28",
  );
});
test("cancelled loading cannot reappear after its response arrives", async ({
  page,
}) => {
  const requests = await setup(page);
  const neo = defaultNeo;
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    `**/api/neo-trajectory?id=${encodeURIComponent(neo.id)}&*`,
    async (route) => {
      requests.trajectories.push(neo.id);
      await gate;
      await route.fulfill({ json: trajectories[neo.id] });
    },
  );
  await page.getByLabel("Discovery date (UTC)").fill("2026-09-27");
  await page.getByRole("button", { name: "Load NEOs for 2026-09-27" }).click();
  const row = page.locator(".neo-row").filter({ hasText: neo.name });
  await row.getByRole("button", { name: "Cancel", exact: true }).click();
  release!();
  await expect(
    page.locator(".neo-row .neo-state", { hasText: "LOADED" }),
  ).toHaveCount(2);
  await expect(
    row.getByRole("button", { name: "Add to visualization" }),
  ).toBeVisible();
  await row.getByRole("button", { name: "Add to visualization" }).click();
  await expect(
    page.locator(".neo-row .neo-state", { hasText: "LOADED" }),
  ).toHaveCount(3);
  expect(requests.trajectories.filter((id) => id === neo.id)).toHaveLength(1);
});
test("discovery failure leaves Earth and the clock usable; retry recovers", async ({
  page,
}) => {
  await setup(page);
  let calls = 0;
  await page.route("**/api/discovery?*", (route) => {
    calls++;
    return calls === 1
      ? route.fulfill({
          status: 429,
          json: { error: "NASA rate limit exceeded. Wait before retrying." },
        })
      : route.fulfill({ json: { ...fixture.discovery, objects: [] } });
  });
  await page.getByLabel("Discovery date (UTC)").fill("2026-09-27");
  await page.getByRole("button", { name: "Load NEOs for 2026-09-27" }).click();
  await expect(
    page.locator(".discovery-panel").getByRole("alert"),
  ).toContainText("NASA rate limit exceeded");
  await page.getByRole("button", { name: "Step backward one day" }).click();
  await expect(page.locator(".clock time")).toContainText("27 Sept 2026");
  await page.getByRole("button", { name: "Load NEOs for 2026-09-27" }).click();
  await expect(
    page.getByText("No Earth approaches returned for this window."),
  ).toBeVisible();
  expect(calls).toBe(2);
});
test("narrow screens keep controls and discovery accessible without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.getByLabel("Discovery date (UTC)").fill("2026-09-27");
  await page.getByRole("button", { name: "Load NEOs for 2026-09-27" }).click();
  await expect(
    page.locator(".neo-row .neo-state", { hasText: "LOADED" }),
  ).toHaveCount(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Step backward one day" }).click();
  await expect(page.locator(".clock time")).toContainText("27 Sept 2026");
});
