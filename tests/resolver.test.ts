import { describe, expect, it } from "vitest";
import { resolveHorizonsTarget } from "../src/lib/jpl/resolver";
import { extractResult } from "../src/lib/jpl/parser";
import type { NearEarthObject } from "../src/models/neo";
const neo = (name: string): NearEarthObject => ({
  id: "neo:2099942",
  nasaId: "2099942",
  name,
  potentiallyHazardous: true,
  closeApproaches: [],
});
describe("Horizons identity resolution", () => {
  it("uses the provisional designation, never arithmetic on NASA IDs", () => {
    const result = resolveHorizonsTarget(neo("99942 Apophis (2004 MN4)"));
    expect(result.command).toBe("DES=2004 MN4;");
    expect(
      result.identity.test("99942 Apophis (2004 MN4) {source: JPL#220}"),
    ).toBe(true);
    expect(
      result.identity.test("99942 Apophis (2004 MN40) {source: JPL#220}"),
    ).toBe(false);
  });
  it("handles unnumbered and numbered objects", () => {
    const target = resolveHorizonsTarget(neo("(2026 AB12)"));
    expect(target.command).toBe("DES=2026 AB12;");
    expect(target.identity.test("(2026 AB12) {source: JPL#1}")).toBe(true);
    expect(resolveHorizonsTarget(neo("433 Eros")).command).toBe("433;");
  });
  it("rejects unresolved names and injected commands", () => {
    expect(() => resolveHorizonsTarget(neo("2099942"))).toThrow(
      /Cannot resolve/,
    );
    expect(() => resolveHorizonsTarget(neo("Apophis; COMMAND=399"))).toThrow(
      /Cannot resolve/,
    );
  });
  it("separates missing and ambiguous Horizons targets", () => {
    expect(() => extractResult({ result: "No matches found." })).toThrow(
      /could not find/,
    );
    expect(() =>
      extractResult({ result: "Matching small-bodies: 3 matches found" }),
    ).toThrow(/ambiguous/);
  });
});
