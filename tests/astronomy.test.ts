import { describe, expect, it } from "vitest";
import {
  advanceTime,
  clampTime,
  DAY,
  initialRange,
} from "../src/lib/astronomy/time";
import {
  distance,
  interpolatePosition,
  toScene,
} from "../src/lib/astronomy/interpolate";
import type { TrajectoryPoint } from "../src/models/trajectory";
const sample = (time: number, x: number, y = 0, z = 0): TrajectoryPoint => ({
  time,
  x,
  y,
  z,
  vx: 0,
  vy: 0,
  vz: 0,
});
describe("trajectory interpolation", () => {
  const points = [
    sample(0, 0, 2, -4),
    sample(100, 2, 4, 0),
    sample(300, 10, 0, 4),
  ];
  it("interpolates all coordinates and handles unequal intervals", () => {
    expect(interpolatePosition(points, 50)).toEqual({ x: 1, y: 3, z: -2 });
    expect(interpolatePosition(points, 200)).toEqual({ x: 6, y: 2, z: 2 });
  });
  it("returns exact samples and clamps both boundaries", () => {
    expect(interpolatePosition(points, 100)).toEqual({ x: 2, y: 4, z: 0 });
    expect(interpolatePosition(points, -1)).toEqual({ x: 0, y: 2, z: -4 });
    expect(interpolatePosition(points, 301)).toEqual({ x: 10, y: 0, z: 4 });
  });
  it("rejects missing samples and invalid timestamps", () => {
    expect(() => interpolatePosition([], 0)).toThrow();
    expect(() => interpolatePosition(points, NaN)).toThrow();
  });
  it("rotates the ecliptic frame without changing distance", () => {
    const position = { x: 1, y: 2, z: 3 };
    expect(toScene(position)).toEqual([1, 3, -2]);
    expect(Math.hypot(...toScene(position))).toBe(distance(position));
  });
});
describe("UTC time range and playback", () => {
  it("aligns to UTC days including leap years", () => {
    const range = initialRange(Date.parse("2024-02-29T18:00:00Z"));
    expect(new Date(range.start).toISOString()).toBe(
      "2023-03-01T00:00:00.000Z",
    );
    expect(new Date(range.end).toISOString()).toBe("2025-03-01T00:00:00.000Z");
    expect(range.end - range.start).toBe(731 * DAY);
  });
  it("advances with elapsed time rather than frame count", () => {
    const range = { start: 0, end: 20 * DAY };
    const rate = DAY / 1000;
    const oneFrame = advanceTime(DAY, 1000, rate, range);
    let manyFrames = DAY;
    for (let i = 0; i < 100; i++)
      manyFrames = advanceTime(manyFrames, 10, rate, range);
    expect(manyFrames).toBe(oneFrame);
    expect(advanceTime(2 * DAY, 1000, -rate, range)).toBe(DAY);
  });
  it("stops at either range boundary", () => {
    expect(advanceTime(50, 1000, 1, { start: 0, end: 100 })).toBe(100);
    expect(advanceTime(50, 1000, -1, { start: 0, end: 100 })).toBe(0);
    expect(() => clampTime(NaN, { start: 0, end: 100 })).toThrow();
    expect(() => clampTime(5, { start: 100, end: 0 })).toThrow();
  });
});
