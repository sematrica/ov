import { describe, it, expect } from "vitest";
import {
  normalizeSpacecraftLookup,
  resolveSpacecraftId,
  spacecraftTarget,
  normalizeSpacecraftQuery,
} from "../src/lib/spacecraft/lookup";
import {
  getMissionMetadata,
  selectMetadataProvider,
  telemetryAvailable,
} from "../src/lib/spacecraft/metadata";
import {
  spacecraftMeasurements,
  calculatedLightTimeSeconds,
  coversTime,
} from "../src/lib/spacecraft/measurements";
import { spacecraftCadence } from "../src/lib/spacecraft/sampling";
import { trajectoryCacheKey } from "../src/lib/jpl/cacheKey";
import { parseExplorerLink } from "../src/lib/explorer/state";
import type { SpaceObjectTrajectory } from "../src/models/trajectory";
const payload = {
  signature: { version: "1.1", source: "NASA/JPL Horizons Lookup API" },
  count: 2,
  result: [
    {
      spkid: "-31",
      name: "Voyager 1 (spacecraft)",
      type: "spacecraft",
      pdes: "1977-084A",
      alias: ["VGR1"],
    },
    {
      spkid: "-32",
      name: "Voyager 2 (spacecraft)",
      type: "spacecraft",
      pdes: "1977-076A",
      alias: [],
    },
  ],
};
const trajectory: SpaceObjectTrajectory = {
  id: "spacecraft:-31",
  name: "Voyager 1",
  target: "Voyager 1 (-31)",
  points: [
    { time: 0, x: 3, y: 4, z: 0, vx: 1, vy: 0, vz: 0 },
    { time: 1000, x: 3, y: 4, z: 0, vx: 1, vy: 0, vz: 0 },
  ],
};
describe("Spacecraft Explorer", () => {
  it("normalizes spacecraft identity, designation, aliases and domain type", () => {
    const records = normalizeSpacecraftLookup(payload);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      id: "spacecraft:-31",
      name: "Voyager 1",
      type: "spacecraft",
      horizonsId: "-31",
      designation: "1977-084A",
      aliases: ["VGR1"],
      trajectoryAvailable: true,
      telemetryAvailable: false,
    });
  });
  it("handles no results and rejects wrong types, versions or incomplete results", () => {
    expect(
      normalizeSpacecraftLookup({ ...payload, count: "0", result: undefined }),
    ).toEqual([]);
    expect(() =>
      normalizeSpacecraftLookup({
        ...payload,
        signature: { ...payload.signature, version: "99" },
      }),
    ).toThrow();
    expect(() => normalizeSpacecraftLookup({ ...payload, count: 3 })).toThrow();
    expect(() =>
      normalizeSpacecraftLookup({
        ...payload,
        count: 1,
        result: [{ ...payload.result[0], type: "asteroid" }],
      }),
    ).toThrow();
  });
  it("resolves only a selected exact signed ID and verifies target identity", () => {
    const s = resolveSpacecraftId(normalizeSpacecraftLookup(payload), "-31");
    expect(spacecraftTarget(s).command).toBe("-31");
    expect(
      spacecraftTarget(s).identity.test(
        "Voyager 1 (spacecraft) (-31) {source: VGR}",
      ),
    ).toBe(true);
    expect(spacecraftTarget(s).identity.test("Voyager 2 (-32)")).toBe(false);
    expect(() =>
      resolveSpacecraftId(normalizeSpacecraftLookup(payload), "Voyager"),
    ).toThrow();
  });
  it("normalizes names without guessing IDs", () => {
    expect(normalizeSpacecraftQuery("  New   Horizons ")).toBe("New Horizons");
    expect(() => normalizeSpacecraftQuery("")).toThrow();
    expect(() => normalizeSpacecraftQuery("command;drop")).toThrow();
  });
  it("selects metadata independently and never invents a telemetry capability", async () => {
    const s = normalizeSpacecraftLookup(payload)[0];
    expect(selectMetadataProvider(s)?.id).toBe("nasa-mission-profiles");
    expect((await getMissionMetadata(s))?.launchDate).toBe("1977-09-05");
    expect(telemetryAvailable(s)).toBe(false);
    const unknown = { ...s, name: "Unknown mission" };
    expect(selectMetadataProvider(unknown)).toBeUndefined();
    expect(await getMissionMetadata(unknown)).toBeUndefined();
  });
  it("calculates Sun/Earth distances, vector speed and geometric light time", () => {
    const earth = {
      ...trajectory,
      id: "earth" as const,
      points: trajectory.points.map((p) => ({ ...p, x: 3, y: 0 })),
    };
    const m = spacecraftMeasurements(trajectory, 500, earth)!;
    expect(m.sunAu).toBe(5);
    expect(m.earthAu).toBe(4);
    expect(m.sunKm).toBe(5 * 149597870.7);
    expect(m.speedKmPerSecond).toBeCloseTo(149597870.7 / 86400);
    expect(calculatedLightTimeSeconds(299792.458)).toBe(1);
    expect(m.lightTimeSeconds).toBeCloseTo((4 * 149597870.7) / 299792.458);
  });
  it("never extrapolates and handles missing Earth coverage independently", () => {
    expect(coversTime(trajectory, -1)).toBe(false);
    expect(spacecraftMeasurements(trajectory, 1001)).toBeUndefined();
    expect(spacecraftMeasurements(trajectory, 500)?.earthAu).toBeUndefined();
    expect(coversTime(trajectory, 1000)).toBe(true);
  });
  it("keeps spacecraft keys distinct and applies centralized sampling", () => {
    const range = { start: 0, end: 86400000 };
    expect(trajectoryCacheKey("-31", range, 60, "spacecraft")).not.toBe(
      trajectoryCacheKey("-31", range, 60, "planet-wide"),
    );
    expect(spacecraftCadence(range)).toBe(60);
    expect(spacecraftCadence({ start: 0, end: 60 * 86400000 })).toBe(360);
  });
  it("accepts spacecraft deep links without changing signed IDs", () =>
    expect(
      parseExplorerLink(new URLSearchParams("object=spacecraft:-31&mode=solar"))
        .object,
    ).toBe("spacecraft:-31"));
});
