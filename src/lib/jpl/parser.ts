import type { TrajectoryPoint } from "../../models/trajectory";
const UNIX_EPOCH_JD = 2440587.5;
export class HorizonsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HorizonsError";
  }
}
export function extractResult(payload: unknown): string {
  if (!payload || typeof payload !== "object")
    throw new HorizonsError("JPL returned an invalid response.");
  if ("error" in payload && typeof payload.error === "string")
    throw new HorizonsError(`JPL Horizons: ${payload.error}`);
  if (!("result" in payload) || typeof payload.result !== "string")
    throw new HorizonsError("JPL response is missing its result field.");
  if (
    /Multiple major-bodies match|Matching small-bodies|(?<!No )matches found|Record #\s+Epoch-yr/i.test(
      payload.result,
    )
  ) {
    throw new HorizonsError(
      "JPL returned an ambiguous object match. A unique designation is required.",
    );
  }
  if (
    /No matches found|No match found|Cannot find|Unknown target|No such object/i.test(
      payload.result,
    )
  ) {
    throw new HorizonsError(
      "Horizons could not find this asteroid. Its designation may not yet be available in JPL.",
    );
  }
  return payload.result;
}
export function parseVectors(
  result: string,
  expectedTarget: RegExp,
): { target: string; points: TrajectoryPoint[] } {
  const target = result.match(/Target body name:\s*([^\r\n]+)/)?.[1]?.trim();
  if (!target || !expectedTarget.test(target))
    throw new HorizonsError(
      "JPL resolved an unexpected or missing target identity.",
    );
  if (
    !/Center body name:\s*Sun\s*\(10\)/.test(result) ||
    !/Output units\s*:\s*AU-D/.test(result) ||
    !/JDTDB|JDUT/.test(result)
  ) {
    throw new HorizonsError(
      "JPL returned an unexpected origin, time column, or distance unit.",
    );
  }
  // TIME_TYPE=UT is explicit in the service. Never interpret default TDB as UTC.
  if (
    !/JDUT\s*,/.test(result) ||
    !/Reference frame\s*:\s*Ecliptic of J2000/i.test(result)
  ) {
    throw new HorizonsError(
      "JPL returned an unexpected time scale or reference frame.",
    );
  }
  const start = result.indexOf("$$SOE");
  const end = result.indexOf("$$EOE");
  if (start < 0 || end <= start)
    throw new HorizonsError("JPL returned no vector samples.");
  const rows = result
    .slice(start + 5, end)
    .trim()
    .split(/\r?\n/);
  const points = rows.map((row): TrajectoryPoint => {
    const columns = row.split(",").map((value) => value.trim());
    const numeric = [columns[0], ...columns.slice(2, 8)];
    if (
      numeric.length !== 7 ||
      numeric.some((value) => !value || !Number.isFinite(Number(value)))
    ) {
      throw new HorizonsError("JPL returned a malformed vector sample.");
    }
    const [jd, x, y, z, vx, vy, vz] = numeric.map(Number);
    return {
      time: Math.round((jd - UNIX_EPOCH_JD) * 86_400_000),
      x,
      y,
      z,
      vx,
      vy,
      vz,
    };
  });
  if (
    points.length < 2 ||
    points.some((point, i) => i > 0 && point.time <= points[i - 1].time)
  ) {
    throw new HorizonsError(
      "JPL vector samples must be ordered and contain at least two timestamps.",
    );
  }
  return { target, points };
}
