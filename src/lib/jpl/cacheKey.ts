import type { TimeRange } from "../../models/trajectory";
export function trajectoryCacheKey(
  object: string,
  range: TimeRange,
  minutes: number,
  purpose:
    | "planet-wide"
    | "long-range-asteroid"
    | "encounter-high-resolution"
    | "spacecraft",
  context = "heliocentric:J2000-ecliptic:UTC:AU-D",
) {
  return JSON.stringify([
    purpose,
    context,
    object,
    range.start,
    range.end,
    minutes,
  ]);
}
