import type {
  NearEarthObject,
  CloseApproach,
  DiscoveryWindow,
} from "../../models/neo";
import { DAY, utcDate } from "../astronomy/time";
import { parseDate } from "../neows/window";
export interface CloseApproachEvent {
  id: string;
  object: NearEarthObject;
  approach: CloseApproach;
  discoveryDate: string;
}
export interface EventResult {
  events: CloseApproachEvent[];
  failures: { window: DiscoveryWindow; error: string }[];
}
export function splitDateRange(start: string, end: string): DiscoveryWindow[] {
  const a = parseDate(start),
    b = parseDate(end);
  if (b < a || b - a >= 90 * DAY)
    throw new Error("Choose a range of 1–90 days between 1900 and 2100.");
  const windows: DiscoveryWindow[] = [];
  for (let t = a; t <= b; t += 7 * DAY)
    windows.push({ start: utcDate(t), end: utcDate(Math.min(b, t + 6 * DAY)) });
  return windows;
}
export function normalizeEvents(
  objects: NearEarthObject[],
): CloseApproachEvent[] {
  return deduplicateEvents(
    objects.flatMap((object) =>
      object.closeApproaches
        .filter((a) => a.orbitingBody === "Earth")
        .map((approach) => ({
          id: `${object.id}:${approach.time}:Earth`,
          object,
          approach,
          discoveryDate: utcDate(approach.time),
        })),
    ),
  );
}
export function deduplicateEvents(events: CloseApproachEvent[]) {
  return [...new Map(events.map((e) => [e.id, e])).values()];
}
export type EventSort = "date" | "distance" | "diameter" | "velocity";
export interface EventFilters {
  hazardous: boolean;
  maxDistance: number;
  minDiameter: number;
}
export function filterEvents(
  events: CloseApproachEvent[],
  filters: EventFilters,
) {
  return events.filter(
    (e) =>
      (!filters.hazardous || e.object.potentiallyHazardous) &&
      (!filters.maxDistance ||
        (e.approach.missDistanceLunar ?? Infinity) <= filters.maxDistance) &&
      (!filters.minDiameter ||
        (e.object.estimatedDiameterMeters?.max ?? -Infinity) >=
          filters.minDiameter),
  );
}
export function sortEvents(events: CloseApproachEvent[], sort: EventSort) {
  const value = (e: CloseApproachEvent) =>
    sort === "date"
      ? e.approach.time
      : sort === "distance"
        ? (e.approach.missDistanceKm ?? Infinity)
        : sort === "diameter"
          ? -(e.object.estimatedDiameterMeters?.max ?? -Infinity)
          : -(e.approach.relativeVelocityKmPerSecond ?? -Infinity);
  return [...events].sort(
    (a, b) => value(a) - value(b) || a.id.localeCompare(b.id),
  );
}
