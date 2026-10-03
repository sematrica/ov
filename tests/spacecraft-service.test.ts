import { afterEach, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  HorizonsService,
  getSpacecraftTrajectory,
} from "../src/lib/jpl/horizons";
import { HorizonsSpacecraftSearchService } from "../src/lib/spacecraft/service";
import { spacecraftTarget } from "../src/lib/spacecraft/lookup";
import { extractResult } from "../src/lib/jpl/parser";
import fixture from "./fixtures/spacecraft.json";
import type { Spacecraft } from "../src/models/spacecraft";
afterEach(() => {
  vi.unstubAllGlobals();
});
const craft = fixture.records[0].spacecraft as Spacecraft;
const raw = `Target body name: Voyager 1 (spacecraft) (-31) {source: test}
Center body name: Sun (10)
Output units : AU-D
Reference frame : Ecliptic of J2000
JDUT,Calendar Date (UT),X,Y,Z,VX,VY,VZ,
$$SOE
2461316.5,A.D. 2026-Oct-03 00:00:00.0000,1,2,3,0.1,0.2,0.3,
2461317.5,A.D. 2026-Oct-04 00:00:00.0000,2,3,4,0.1,0.2,0.3,
$$EOE`;
describe("spacecraft service integration", () => {
  it("uses official lookup with group=sct and normalizes multiple results", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify(fixture.lookup)),
    );
    vi.stubGlobal("fetch", fetcher);
    const matches = await new HorizonsSpacecraftSearchService().search(
      "Voyager",
    );
    expect(matches).toHaveLength(2);
    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    expect(url.hostname).toBe("ssd.jpl.nasa.gov");
    expect(url.searchParams.get("group")).toBe("sct");
  });
  it("reuses the existing Cartesian vector service and scientific request frame", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ result: raw })),
    );
    vi.stubGlobal("fetch", fetcher);
    const range = { start: Date.UTC(2026, 9, 3), end: Date.UTC(2026, 9, 4) };
    const result = await new HorizonsService().trajectory(
      spacecraftTarget(craft),
      range,
      60,
    );
    expect(result.id).toBe("spacecraft:-31");
    expect(result.points).toHaveLength(2);
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.searchParams.get("COMMAND")).toBe("'-31'");
    expect(url.searchParams.get("CENTER")).toBe("'500@10'");
    expect(url.searchParams.get("TIME_TYPE")).toBe("'UT'");
    expect(url.searchParams.get("STEP_SIZE")).toBe("'60 min'");
  });
  it("deduplicates spacecraft trajectory acquisition", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ result: raw })),
    );
    vi.stubGlobal("fetch", fetcher);
    const range = { start: Date.UTC(2026, 9, 3), end: Date.UTC(2026, 9, 4) };
    await Promise.all([
      getSpacecraftTrajectory(spacecraftTarget(craft), range, 60),
      getSpacecraftTrajectory(spacecraftTarget(craft), range, 60),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("reports coverage errors without generating or extrapolating samples", () => {
    expect(() =>
      extractResult({ error: "No ephemeris for target after 2017" }),
    ).toThrow("Trajectory unavailable for selected date");
  });
});
