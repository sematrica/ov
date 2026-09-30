import type { CloseApproach, NearEarthObject } from "../../models/neo";
export const DEFAULT_NEO_COUNT = 3;
export const MAX_LOADED_NEOS = 20;
export type NeoSort = "distance" | "diameter" | "date";
export function closestApproach(
  neo: NearEarthObject,
): CloseApproach | undefined {
  return [...neo.closeApproaches].sort(
    (a, b) =>
      (a.missDistanceKm ?? Infinity) - (b.missDistanceKm ?? Infinity) ||
      a.time - b.time,
  )[0];
}
export function sortNeos(
  neos: readonly NearEarthObject[],
  sort: NeoSort,
): NearEarthObject[] {
  const value = (neo: NearEarthObject) =>
    sort === "diameter"
      ? -(neo.estimatedDiameterMeters?.max ?? -Infinity)
      : sort === "date"
        ? (closestApproach(neo)?.time ?? Infinity)
        : (closestApproach(neo)?.missDistanceKm ?? Infinity);
  return [...neos].sort(
    (a, b) => value(a) - value(b) || a.id.localeCompare(b.id),
  );
}
export function filterNeos(
  neos: readonly NearEarthObject[],
  hazardousOnly: boolean,
  minDiameter = 0,
): NearEarthObject[] {
  return neos.filter(
    (neo) =>
      (!hazardousOnly || neo.potentiallyHazardous) &&
      (minDiameter <= 0 ||
        (neo.estimatedDiameterMeters?.max ?? -Infinity) >= minDiameter),
  );
}
export function selectDefaultObjects(
  neos: readonly NearEarthObject[],
  max = DEFAULT_NEO_COUNT,
): NearEarthObject[] {
  return sortNeos(
    neos.filter((neo) => closestApproach(neo)?.missDistanceKm !== undefined),
    "distance",
  ).slice(0, Math.max(0, Math.floor(max)));
}
