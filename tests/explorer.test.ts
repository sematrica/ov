import { describe, it, expect } from "vitest";
import {
  splitDateRange,
  normalizeEvents,
  deduplicateEvents,
  sortEvents,
  filterEvents,
} from "../src/lib/explorer/events";
import { parseExplorerLink, explorerUrl } from "../src/lib/explorer/state";
import {
  BODIES,
  bodyMetadata,
  normalizeSearch,
  matchesSearch,
} from "../src/lib/explorer/catalog";
import { trajectoryCacheKey } from "../src/lib/jpl/cacheKey";
import type { NearEarthObject } from "../src/models/neo";
const neo: NearEarthObject = {
  id: "neo:1",
  nasaId: "1",
  name: "Test",
  potentiallyHazardous: false,
  estimatedDiameterMeters: { min: 5, max: 10 },
  closeApproaches: [
    {
      time: Date.UTC(2026, 9, 3),
      timePrecision: "minute",
      orbitingBody: "Earth",
      missDistanceKm: 10,
      missDistanceLunar: 1,
      relativeVelocityKmPerSecond: 2,
    },
    {
      time: Date.UTC(2026, 9, 4),
      timePrecision: "minute",
      orbitingBody: "Earth",
      missDistanceKm: 20,
      missDistanceLunar: 2,
      relativeVelocityKmPerSecond: 5,
    },
  ],
};
describe("Stage 4 exploration", () => {
  it("splits inclusive ranges without gaps or duplicates", () => {
    const w = splitDateRange("2026-10-01", "2026-10-30");
    expect(w).toHaveLength(5);
    expect(w[0]).toEqual({ start: "2026-10-01", end: "2026-10-07" });
    expect(w[1].start).toBe("2026-10-08");
    expect(w[4].end).toBe("2026-10-30");
    expect(splitDateRange("2024-02-28", "2024-03-01")).toHaveLength(1);
  });
  it("rejects invalid, reversed and excessive ranges", () => {
    for (const [a, b] of [
      ["2026-02-30", "2026-03-01"],
      ["2026-02-02", "2026-02-01"],
      ["2026-01-01", "2026-12-31"],
    ])
      expect(() => splitDateRange(a, b)).toThrow();
  });
  it("normalizes multiple encounters per asteroid and deduplicates", () => {
    const e = normalizeEvents([neo, neo]);
    expect(e).toHaveLength(2);
    expect(e[0].discoveryDate).toBe("2026-10-03");
    expect(deduplicateEvents([...e, ...e])).toHaveLength(2);
    expect(
      normalizeEvents([
        {
          ...neo,
          closeApproaches: [
            { ...neo.closeApproaches[0], orbitingBody: "Mars" },
          ],
        },
      ]),
    ).toHaveLength(0);
  });
  it("sorts distance, date, diameter and velocity without mutation", () => {
    const e = normalizeEvents([
      neo,
      {
        ...neo,
        id: "neo:2",
        estimatedDiameterMeters: { min: 50, max: 100 },
        closeApproaches: [
          {
            ...neo.closeApproaches[0],
            time: Date.UTC(2026, 9, 5),
            missDistanceKm: 1,
          },
        ],
      },
    ]);
    expect(sortEvents(e, "distance")[0].object.id).toBe("neo:2");
    expect(sortEvents(e, "diameter")[0].object.id).toBe("neo:2");
    expect(
      sortEvents(e, "velocity")[0].approach.relativeVelocityKmPerSecond,
    ).toBe(5);
    expect(sortEvents(e, "date")[0].approach.time).toBe(
      neo.closeApproaches[0].time,
    );
  });
  it("filters hazard, distance and size, excludes unknown measurements when filtering", () => {
    const e = normalizeEvents([neo]);
    expect(
      filterEvents(e, { hazardous: true, maxDistance: 0, minDiameter: 0 }),
    ).toHaveLength(0);
    expect(
      filterEvents(e, { hazardous: false, maxDistance: 1, minDiameter: 5 }),
    ).toHaveLength(1);
    expect(
      filterEvents(e, { hazardous: false, maxDistance: 0, minDiameter: 11 }),
    ).toHaveLength(0);
  });
  it("parses and round-trips links", () => {
    const s = {
      date: "2026-10-03",
      object: "neo:1",
      mode: "encounter" as const,
      event: 1790985600000,
    };
    expect(
      parseExplorerLink(
        new URL(explorerUrl(s), "http://localhost").searchParams,
      ),
    ).toEqual(s);
    expect(parseExplorerLink(new URLSearchParams("object=99942")).object).toBe(
      "99942",
    );
    expect(() => parseExplorerLink(new URLSearchParams("date=oops"))).toThrow();
    expect(() =>
      parseExplorerLink(new URLSearchParams("mode=impact")),
    ).toThrow();
    expect(() => parseExplorerLink(new URLSearchParams("event=NaN"))).toThrow();
  });
  it("normalizes object search", () => {
    expect(normalizeSearch(" (2026 AB) ")).toBe("2026 ab");
    expect(matchesSearch("99942", "99942 Apophis")).toBe(true);
    expect(matchesSearch("BENNU", "101955 Bennu")).toBe(true);
  });
  it("keys purpose, coordinates, time and cadence independently", () => {
    const r = { start: 0, end: 10 };
    const k = trajectoryCacheKey("399", r, 10, "planet-wide");
    expect(k).not.toBe(
      trajectoryCacheKey("399", r, 10, "encounter-high-resolution"),
    );
    expect(k).not.toBe(trajectoryCacheKey("399", r, 20, "planet-wide"));
    expect(k).not.toBe(
      trajectoryCacheKey("399", r, 10, "planet-wide", "earth-relative"),
    );
    expect(k).not.toBe(
      trajectoryCacheKey("399", { start: 1, end: 10 }, 10, "planet-wide"),
    );
  });
  it("maps planet identities and reasonable cadences centrally", () => {
    expect(bodyMetadata("jupiter")?.horizonsId).toBe("599");
    expect(bodyMetadata("saturn")?.horizonsId).toBe("699");
    expect(bodyMetadata("moon")?.horizonsId).toBe("301");
    expect(new Set(BODIES.map((b) => b.id)).size).toBe(BODIES.length);
    expect(BODIES.filter((b) => b.type === "planet")).toHaveLength(6);
  });
});
