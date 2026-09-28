import { describe, expect, it } from "vitest";
import fixture from "./fixtures/apophis-horizons.json";
import { extractResult, parseVectors } from "../src/lib/jpl/parser";
const identity = /^99942 Apophis\s*\(2004 MN4\)/;
const result = extractResult(fixture);
describe("Horizons vector parser using an authentic JPL response", () => {
  it("normalizes CSV vectors and Julian UTC dates", () => {
    const data = parseVectors(result, identity);
    expect(data.target).toContain("99942 Apophis (2004 MN4)");
    expect(data.points).toHaveLength(5);
    expect(new Date(data.points[0].time).toISOString()).toBe(
      "2026-09-27T00:00:00.000Z",
    );
    expect(data.points[0].x).toBeCloseTo(-0.3403230801086534, 12);
    expect(data.points[0].vx).toBeCloseTo(0.01850405488220729, 12);
    expect(data.points[4].time - data.points[0].time).toBe(86_400_000);
  });
  it("rejects ambiguous matches and API errors", () => {
    expect(() =>
      extractResult({ result: "Matching small-bodies: 2 matches found" }),
    ).toThrow(/ambiguous/);
    expect(() => extractResult({ error: "Invalid COMMAND" })).toThrow(
      /Invalid COMMAND/,
    );
    expect(() => extractResult({})).toThrow(/result/);
  });
  it("rejects a wrong target, unit, time scale, origin, and frame", () => {
    expect(() => parseVectors(result, /^Earth/)).toThrow(/identity/);
    expect(() =>
      parseVectors(result.replace("AU-D", "KM-S"), identity),
    ).toThrow(/unit/);
    expect(() =>
      parseVectors(result.replace("JDUT", "JDTDB"), identity),
    ).toThrow(/time scale/);
    expect(() =>
      parseVectors(
        result.replace(/Center body name:.*/, "Center body name: Earth (399)"),
        identity,
      ),
    ).toThrow(/origin/);
    expect(() =>
      parseVectors(
        result.replace(
          "Reference frame : Ecliptic of J2000.0",
          "Reference frame : ICRF",
        ),
        identity,
      ),
    ).toThrow(/reference frame/);
  });
  it("rejects missing and malformed samples", () => {
    expect(() => parseVectors(result.replace("$$SOE", ""), identity)).toThrow(
      /no vector/,
    );
    expect(() =>
      parseVectors(
        result.replace("-3.403230801086534E-01", "invalid"),
        identity,
      ),
    ).toThrow(/malformed/);
    expect(() =>
      parseVectors(
        result.replace("2461310.750000000", "2461310.500000000"),
        identity,
      ),
    ).toThrow(/ordered/);
  });
});
