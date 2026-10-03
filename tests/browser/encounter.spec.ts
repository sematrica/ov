import { test, expect, type Page } from "@playwright/test";
import fixture from "../fixtures/stage2-browser.json";
import encounter from "../fixtures/encounter.json";
async function setup(page: Page, failure = false, moonFailure = false) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let count = 0;
  await page.route("**/api/planet?*", route=>route.fulfill({status:503,json:{error:"Planet data excluded from this regression fixture."}}));
  await page.route("**/api/trajectories", (r) =>
    r.fulfill({ json: fixture.earth }),
  );
  await page.route("**/api/discovery?*", (r) =>
    r.fulfill({ json: fixture.discovery }),
  );
  await page.route("**/api/neo-trajectory?*", (r) =>
    r.fulfill({
      json: fixture.trajectories[
        new URL(r.request().url()).searchParams.get(
          "id",
        ) as keyof typeof fixture.trajectories
      ],
    }),
  );
  await page.route("**/api/encounter?*", (r) => {
    count++;
    return r.fulfill({
      status: failure ? 502 : 200,
      json: failure
        ? { error: "Asteroid ephemeris unavailable" }
        : moonFailure
          ? {
              ...encounter,
              moon: undefined,
              moonError: "Moon ephemeris unavailable",
            }
          : encounter,
    });
  });
  await page.goto("/");
  await page.getByLabel("Discovery date (UTC)").fill("2026-09-27");
  await page.getByRole("button", { name: "Load NEOs for 2026-09-27" }).click();
  await page
    .locator(".neo-name")
    .filter({ hasText: encounter.neo.name })
    .click();
  return { errors, count: () => count };
}
test("encounter shares canvas, clock, cached ephemeris and restores solar mode", async ({
  page,
}) => {
  const state = await setup(page);
  await page.locator("canvas").waitFor();
  await page
    .locator("canvas")
    .evaluate((el) => el.setAttribute("data-original", "true"));
  await page.getByRole("button", { name: "View Close Approach" }).click();
  await expect(page.getByLabel("Earth encounter telemetry")).toBeVisible();
  await expect(page.locator("canvas")).toHaveAttribute("data-original", "true");
  await expect(page.getByText("MOON", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Jump to closest approach", exact: true })
    .click();
  await expect(
    page.getByRole("slider", { name: "Simulation timeline" }),
  ).toHaveValue(String(encounter.approach.time));
  const initial = await page.locator(".encounter-distance").innerText();
  await page.getByRole("button", { name: "Step backward ten minutes" }).click();
  await expect(page.locator(".encounter-distance")).not.toHaveText(initial);
  await page
    .getByRole("button", { name: "Follow Asteroid", exact: true })
    .click();
  await page.getByLabel("Show distance line").uncheck();
  await page.getByRole("button", { name: "Play simulation" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Pause simulation" }).click();
  await expect(page.getByLabel("Simulation speed")).toHaveValue("3600");
  await page.getByRole("button", { name: "SOLAR SYSTEM", exact: true }).click();
  await expect(page.getByLabel("Selected object information")).toBeVisible();
  await page.getByRole("button", { name: "View Close Approach" }).click();
  await expect(page.getByLabel("Earth encounter telemetry")).toBeVisible();
  expect(state.count()).toBe(1);
  expect(state.errors).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "SOLAR SYSTEM", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/nearby-stage3-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Focus Earth", exact: true }).click();
  await page.waitForTimeout(2200);
  await page.screenshot({ path: "/tmp/nearby-stage3-desktop.png" });
});
test("failed encounter preserves solar view", async ({ page }) => {
  await setup(page, true);
  await page.getByRole("button", { name: "View Close Approach" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Asteroid ephemeris unavailable",
  );
  await expect(
    page.getByRole("button", { name: "SOLAR SYSTEM", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Selected object information")).toBeVisible();
});
test("Moon failure is separate and retryable", async ({ page }) => {
  const state = await setup(page, false, true);
  await page.getByRole("button", { name: "View Close Approach" }).click();
  await expect(page.getByLabel("Earth encounter telemetry")).toBeVisible();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Moon ephemeris unavailable",
  );
  await expect(page.getByLabel("Moon trail")).toBeDisabled();
  await page.getByRole("button", { name: "SOLAR SYSTEM", exact: true }).click();
  await page.getByRole("button", { name: "View Close Approach" }).click();
  await expect(page.getByLabel("Earth encounter telemetry")).toBeVisible();
  expect(state.count()).toBe(2);
  expect(state.errors).toEqual([]);
});
