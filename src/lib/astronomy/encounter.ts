import { trajectoryCacheKey } from "../jpl/cacheKey";
import type {
  Position,
  TimeRange,
  TrajectoryPoint,
} from "../../models/trajectory";
import { interpolatePosition, distance } from "./interpolate";
import { HOUR } from "./time";
export const AU_KM = 149_597_870.7;
/** Conventional mean Earth–Moon distance, not the Moon's instantaneous distance. */
export const LUNAR_DISTANCE_KM = 384_400;
export const ENCOUNTER_STEP_MINUTES = 10;
export const auToKm = (au: number) => au * AU_KM;
export const kmToLunarDistance = (km: number) => km / LUNAR_DISTANCE_KM;
export function toEarthRelativePosition(
  body: Position,
  earth: Position,
): Position {
  return { x: body.x - earth.x, y: body.y - earth.y, z: body.z - earth.z };
}
export const distanceBetween = (a: Position, b: Position) =>
  distance(toEarthRelativePosition(a, b));
export function relativeVelocity(
  body: TrajectoryPoint,
  earth: TrajectoryPoint,
): Position {
  return {
    x: body.vx - earth.vx,
    y: body.vy - earth.vy,
    z: body.vz - earth.vz,
  };
}
export const relativeSpeedKmPerSecond = (
  a: TrajectoryPoint,
  b: TrajectoryPoint,
) => auToKm(distance(relativeVelocity(a, b))) / 86400;
export function encounterWindow(time: number, halfHours = 24): TimeRange {
  if (
    !Number.isFinite(time) ||
    !Number.isFinite(halfHours) ||
    halfHours <= 0 ||
    halfHours > 72
  )
    throw new Error("Invalid encounter date or duration.");
  const center = Math.floor(time / 60000) * 60000;
  return { start: center - halfHours * HOUR, end: center + halfHours * HOUR };
}
export function encounterCacheKey(
  object: string,
  range: TimeRange,
  minutes = ENCOUNTER_STEP_MINUTES,
) {
  return trajectoryCacheKey(
    object,
    range,
    minutes,
    "encounter-high-resolution",
  );
}
/** Encounter interpolation rejects missing coverage rather than freezing endpoints. */
export function interpolateState(
  points: readonly TrajectoryPoint[],
  time: number,
): TrajectoryPoint {
  if (
    points.length < 2 ||
    !Number.isFinite(time) ||
    time < points[0].time ||
    time > points.at(-1)!.time
  )
    throw new Error("Encounter time is outside ephemeris coverage.");
  let lo = 0,
    hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (points[mid].time <= time) lo = mid;
    else hi = mid;
  }
  const a = points[lo],
    b = points[hi],
    t = (time - a.time) / (b.time - a.time);
  return {
    time,
    ...interpolatePosition(points, time),
    vx: a.vx + (b.vx - a.vx) * t,
    vy: a.vy + (b.vy - a.vy) * t,
    vz: a.vz + (b.vz - a.vz) * t,
  };
}
export function earthRelativeTrajectory(
  body: readonly TrajectoryPoint[],
  earth: readonly TrajectoryPoint[],
): TrajectoryPoint[] {
  return body.map((p) => {
    const e = interpolateState(earth, p.time),
      v = relativeVelocity(p, e);
    return {
      time: p.time,
      ...toEarthRelativePosition(p, e),
      vx: v.x,
      vy: v.y,
      vz: v.z,
    };
  });
}
/** Minimum on the piecewise-linear path; a visualization estimate, not an orbit solution. */
export function trajectoryMinimum(points: readonly TrajectoryPoint[]) {
  if (points.length < 2) throw new Error("Insufficient encounter trajectory.");
  let best = points[0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      d = toEarthRelativePosition(b, a);
    const norm = d.x * d.x + d.y * d.y + d.z * d.z;
    const f = norm
      ? Math.max(0, Math.min(1, -(a.x * d.x + a.y * d.y + a.z * d.z) / norm))
      : 0;
    const p = interpolateState([a, b], a.time + f * (b.time - a.time));
    if (distance(p) < distance(best)) best = p;
  }
  return best;
}
/** A single uniform AU→lunar-distance scale for all encounter geometry. */
export function encounterScenePosition(p: Position): [number, number, number] {
  const scale = AU_KM / LUNAR_DISTANCE_KM;
  return [p.x * scale, p.z * scale, -p.y * scale];
}
