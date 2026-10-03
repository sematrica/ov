import { describe, expect, it } from "vitest";
import {
  auToKm,
  kmToLunarDistance,
  toEarthRelativePosition,
  distanceBetween,
  relativeVelocity,
  relativeSpeedKmPerSecond,
  encounterWindow,
  encounterCacheKey,
  interpolateState,
  earthRelativeTrajectory,
  trajectoryMinimum,
} from "../src/lib/astronomy/encounter";
const p = (time: number, x: number, y = 0) => ({
  time,
  x,
  y,
  z: 0,
  vx: 1,
  vy: 2,
  vz: 3,
});
describe("encounter astronomy", () => {
  it("subtracts Earth without changing axes", () =>
    expect(
      toEarthRelativePosition({ x: 4, y: 6, z: 8 }, { x: 1, y: 2, z: 3 }),
    ).toEqual({ x: 3, y: 4, z: 5 }));
  it("measures 3D center-to-center distance", () =>
    expect(distanceBetween({ x: 1, y: 2, z: 3 }, { x: 3, y: 5, z: 9 })).toBe(
      7,
    ));
  it("converts AU and conventional lunar distances", () => {
    expect(auToKm(1)).toBe(149597870.7);
    expect(kmToLunarDistance(768800)).toBe(2);
  });
  it("subtracts state-vector velocities and converts AU/day to km/s", () => {
    const a = p(0, 0),
      b = { ...p(0, 0), vx: 0, vy: 0, vz: 0 };
    expect(relativeVelocity(a, b)).toEqual({ x: 1, y: 2, z: 3 });
    expect(relativeSpeedKmPerSecond(a, b)).toBeCloseTo(
      (Math.sqrt(14) * 149597870.7) / 86400,
    );
  });
  it("creates configurable windows and rejects invalid dates/durations", () => {
    expect(encounterWindow(86400000)).toEqual({ start: 0, end: 172800000 });
    expect(encounterWindow(86400000, 1).end).toBe(90000000);
    expect(() => encounterWindow(NaN)).toThrow();
    expect(() => encounterWindow(0, -1)).toThrow();
  });
  it("keys object, range and cadence independently", () => {
    const range = { start: 0, end: 10 };
    expect(
      new Set([
        encounterCacheKey("a", range),
        encounterCacheKey("b", range),
        encounterCacheKey("a", { start: 1, end: 10 }),
        encounterCacheKey("a", { start: 0, end: 11 }),
        encounterCacheKey("a", range, 5),
      ]).size,
    ).toBe(5);
  });
  it("interpolates position and velocity, rejects missing coverage", () => {
    const points = [p(0, 1), { ...p(10, 3), vx: 3 }];
    expect(interpolateState(points, 5)).toMatchObject({ x: 2, vx: 2 });
    expect(() => interpolateState(points, -1)).toThrow();
    expect(() => interpolateState(points, 11)).toThrow();
    expect(() => interpolateState([], 0)).toThrow();
  });
  it("uses matching Earth states for relative paths", () =>
    expect(
      earthRelativeTrajectory([p(0, 4), p(10, 8)], [p(0, 1), p(10, 2)]).map(
        (p) => p.x,
      ),
    ).toEqual([3, 6]));
  it("finds interpolated interior and endpoint minima", () => {
    const min = trajectoryMinimum([p(0, -1, 2), p(10, 1, 2)]);
    expect(min.time).toBe(5);
    expect(min.x).toBe(0);
    expect(min.y).toBe(2);
    expect(trajectoryMinimum([p(0, 1), p(10, 2)]).time).toBe(0);
    expect(() => trajectoryMinimum([])).toThrow();
  });
});
