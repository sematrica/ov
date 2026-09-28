import type { Position, TrajectoryPoint } from "../../models/trajectory";
/** Binary search + linear interpolation of six-hour geometric vector samples.
 * Positions remain in the original heliocentric ecliptic frame and AU scale. */
export function interpolatePosition(
  points: readonly TrajectoryPoint[],
  time: number,
): Position {
  if (!points.length || !Number.isFinite(time))
    throw new Error("Cannot interpolate an empty trajectory or invalid time.");
  const first = points[0];
  const last = points[points.length - 1];
  if (time <= first.time) return { x: first.x, y: first.y, z: first.z };
  if (time >= last.time) return { x: last.x, y: last.y, z: last.z };
  let low = 0;
  let high = points.length - 1;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (points[mid].time <= time) low = mid;
    else high = mid;
  }
  const a = points[low];
  const b = points[high];
  const t = (time - a.time) / (b.time - a.time);
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}
/** Proper rotation: ecliptic Z becomes Three.js up; preserves distances/handedness. */
export function toScene(p: Position): [number, number, number] {
  return [p.x, p.z, -p.y];
}
export function distance(p: Position): number {
  return Math.hypot(p.x, p.y, p.z);
}
