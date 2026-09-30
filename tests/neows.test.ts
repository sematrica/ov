import { describe, expect, it } from "vitest";
import fixture from "./fixtures/neows-feed.json";
import { normalizeFeed } from "../src/lib/neows/parser";
import { discoveryWindow, parseDate } from "../src/lib/neows/window";
import {
  closestApproach,
  filterNeos,
  selectDefaultObjects,
  sortNeos,
} from "../src/lib/neo/selection";
const window = discoveryWindow("2026-09-27");
const neos = normalizeFeed(fixture, window);
describe("NeoWs normalization", () => {
  it("normalizes authentic NASA metadata without raw provider links", () => {
    expect(neos).toHaveLength(17);
    const neo = neos.find((n) => n.nasaId === "2376848")!;
    expect(neo.id).toBe("neo:2376848");
    expect(neo.name).toBe("376848 (2001 RY47)");
    expect(neo.estimatedDiameterMeters?.max).toBeCloseTo(711.278987, 5);
    expect(neo.closeApproaches[0].relativeVelocityKmPerSecond).toBeCloseTo(
      12.050562,
      5,
    );
    expect(neo.closeApproaches[0].time).toBe(
      Date.parse("2026-09-26T00:32:00Z"),
    );
    expect(JSON.stringify(neos)).not.toContain("api_key");
    expect(neo).not.toHaveProperty("links");
  });
  it("merges duplicate asteroids and avoids duplicate approaches", () => {
    const row = Object.values(fixture.near_earth_objects).flat()[0];
    expect(
      normalizeFeed(
        { near_earth_objects: { a: [row, row], b: [row] } },
        window,
      ),
    ).toHaveLength(1);
    expect(
      normalizeFeed({ near_earth_objects: { a: [row, row] } }, window)[0]
        .closeApproaches,
    ).toHaveLength(1);
  });
  it("excludes approaches outside the requested window and non-Earth approaches", () => {
    expect(normalizeFeed(fixture, discoveryWindow("2026-10-05"))).toHaveLength(
      0,
    );
    const row = Object.values(fixture.near_earth_objects).flat()[0];
    expect(
      normalizeFeed(
        {
          near_earth_objects: {
            a: [
              {
                ...row,
                close_approach_data: row.close_approach_data.map((a) => ({
                  ...a,
                  orbiting_body: "Mars",
                })),
              },
            ],
          },
        },
        window,
      ),
    ).toHaveLength(0);
  });
  it("handles an empty feed and optional absent measurements", () => {
    expect(normalizeFeed({ near_earth_objects: {} }, window)).toEqual([]);
    const row = Object.values(fixture.near_earth_objects).flat()[0];
    const output = normalizeFeed(
      {
        near_earth_objects: {
          a: [
            {
              ...row,
              estimated_diameter: undefined,
              absolute_magnitude_h: undefined,
              close_approach_data: [
                { close_approach_date: "2026-09-26", orbiting_body: "Earth" },
              ],
            },
          ],
        },
      },
      window,
    )[0];
    expect(output.estimatedDiameterMeters).toBeUndefined();
    expect(output.closeApproaches[0].missDistanceKm).toBeUndefined();
    expect(output.closeApproaches[0].timePrecision).toBe("day");
  });
  it("rejects malformed responses rather than inventing measurements", () => {
    expect(() => normalizeFeed({}, window)).toThrow(/Malformed/);
    const row = Object.values(fixture.near_earth_objects).flat()[0];
    expect(() =>
      normalizeFeed(
        {
          near_earth_objects: {
            a: [{ ...row, is_potentially_hazardous_asteroid: "false" }],
          },
        },
        window,
      ),
    ).toThrow(/Malformed/);
    expect(() =>
      normalizeFeed(
        {
          near_earth_objects: {
            a: [{ ...row, absolute_magnitude_h: "broken" }],
          },
        },
        window,
      ),
    ).toThrow(/Malformed/);
  });
});
describe("discovery window", () => {
  it("uses inclusive UTC dates across leap days and years", () => {
    expect(discoveryWindow("2024-03-01")).toEqual({
      start: "2024-02-29",
      end: "2024-03-02",
    });
    expect(discoveryWindow("2026-01-01")).toEqual({
      start: "2025-12-31",
      end: "2026-01-02",
    });
  });
  it("rejects invalid dates and oversized windows", () => {
    expect(() => parseDate("2026-02-30")).toThrow();
    expect(() => parseDate("2026-01-01T12:00:00Z")).toThrow();
    expect(() => discoveryWindow("2026-01-01", 4)).toThrow();
  });
});
describe("discovery selection", () => {
  it("loads only the three closest known Earth approaches by default", () => {
    const selected = selectDefaultObjects(neos);
    expect(selected).toHaveLength(3);
    expect(selected).toEqual(sortNeos(neos, "distance").slice(0, 3));
    expect(selectDefaultObjects(neos, 1)).toHaveLength(1);
    expect(selectDefaultObjects([{ ...neos[0], closeApproaches: [] }])).toEqual(
      [],
    );
  });
  it("sorts without mutating data, with missing values last", () => {
    const original = neos.map((n) => n.id);
    for (const sort of ["distance", "diameter", "date"] as const) {
      const unknown = {
        ...neos[0],
        id: "neo:0" as const,
        estimatedDiameterMeters: undefined,
        closeApproaches: [],
      };
      expect(sortNeos([...neos, unknown], sort).at(-1)?.id).toBe("neo:0");
    }
    const largest = sortNeos(neos, "diameter");
    expect(largest[0].estimatedDiameterMeters!.max).toBe(
      Math.max(...neos.map((n) => n.estimatedDiameterMeters!.max)),
    );
    const earliest = sortNeos(neos, "date");
    expect(closestApproach(earliest[0])!.time).toBe(
      Math.min(...neos.map((n) => closestApproach(n)!.time)),
    );
    expect(neos.map((n) => n.id)).toEqual(original);
  });
  it("filters the NASA classification and maximum estimated diameter", () => {
    const filtered = filterNeos(neos, true, 200);
    expect(
      filtered.every(
        (n) => n.potentiallyHazardous && n.estimatedDiameterMeters!.max >= 200,
      ),
    ).toBe(true);
    expect(filterNeos(neos, false)).toHaveLength(17);
  });
});
