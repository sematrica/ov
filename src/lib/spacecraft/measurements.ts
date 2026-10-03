import type { SpaceObjectTrajectory } from "../../models/trajectory";
import {
  interpolateState,
  auToKm,
  distanceBetween,
} from "../astronomy/encounter";
import { distance } from "../astronomy/interpolate";
export const LIGHT_SPEED_KM_PER_SECOND = 299792.458;
export const calculatedLightTimeSeconds = (distanceKm: number) =>
  distanceKm / LIGHT_SPEED_KM_PER_SECOND;
export function coversTime(
  trajectory: SpaceObjectTrajectory | undefined,
  time: number,
): trajectory is SpaceObjectTrajectory {
  return (
    !!trajectory &&
    trajectory.points.length >= 2 &&
    Number.isFinite(time) &&
    trajectory.points[0].time <= time &&
    trajectory.points.at(-1)!.time >= time
  );
}
export function spacecraftMeasurements(
  trajectory: SpaceObjectTrajectory,
  time: number,
  earth?: SpaceObjectTrajectory,
) {
  if (!coversTime(trajectory, time)) return undefined;
  const point = interpolateState(trajectory.points, time),
    sunAu = distance(point);
  const earthAu = coversTime(earth, time)
    ? distanceBetween(point, interpolateState(earth.points, time))
    : undefined;
  return {
    point,
    sunAu,
    sunKm: auToKm(sunAu),
    earthAu,
    earthKm: earthAu === undefined ? undefined : auToKm(earthAu),
    speedKmPerSecond: auToKm(Math.hypot(point.vx, point.vy, point.vz)) / 86400,
    lightTimeSeconds:
      earthAu === undefined
        ? undefined
        : calculatedLightTimeSeconds(auToKm(earthAu)),
  };
}
