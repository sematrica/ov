import type { CloseApproach, NearEarthObject } from "../../models/neo";
export function measurement(value: number | undefined, digits = 1): string {
  return value === undefined
    ? "Unavailable"
    : value.toLocaleString("en-US", { maximumFractionDigits: digits });
}
export function diameterLabel(neo: NearEarthObject): string {
  const d = neo.estimatedDiameterMeters;
  return d
    ? `${measurement(d.min, 0)}–${measurement(d.max, 0)} m`
    : "Diameter unavailable";
}
export function approachDate(approach: CloseApproach | undefined): string {
  if (!approach) return "Unavailable";
  const iso = new Date(approach.time).toISOString();
  return approach.timePrecision === "day"
    ? `${iso.slice(0, 10)} (time unavailable)`
    : `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}
