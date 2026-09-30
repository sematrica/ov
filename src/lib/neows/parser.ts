import type {
  CloseApproach,
  DiscoveryWindow,
  NearEarthObject,
} from "../../models/neo";
import { DAY } from "../astronomy/time";
import { parseDate } from "./window";
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Malformed NASA NeoWs response: expected an object.");
  return value as Record<string, unknown>;
}
function number(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    !Number.isFinite(Number(value))
  )
    throw new Error("Malformed NASA NeoWs response: invalid number.");
  return Number(value);
}
function nonnegative(value: unknown): number | undefined {
  const result = number(value);
  if (result !== undefined && result < 0)
    throw new Error("Malformed NASA NeoWs response: negative measurement.");
  return result;
}
function approach(value: unknown): CloseApproach {
  const raw = record(value);
  const epoch = number(raw.epoch_date_close_approach);
  const date =
    typeof raw.close_approach_date === "string"
      ? parseDate(raw.close_approach_date)
      : undefined;
  if (
    date === undefined ||
    (epoch !== undefined && (epoch < date || epoch >= date + DAY))
  )
    throw new Error("Malformed NASA NeoWs response: invalid approach date.");
  const miss = raw.miss_distance ? record(raw.miss_distance) : {};
  const velocity = raw.relative_velocity ? record(raw.relative_velocity) : {};
  if (typeof raw.orbiting_body !== "string")
    throw new Error("Malformed NASA NeoWs response: missing approach body.");
  return {
    time: epoch ?? date,
    timePrecision: epoch === undefined ? "day" : "minute",
    orbitingBody: raw.orbiting_body,
    missDistanceKm: nonnegative(miss.kilometers),
    missDistanceLunar: nonnegative(miss.lunar),
    relativeVelocityKmPerSecond: nonnegative(velocity.kilometers_per_second),
  };
}
function normalize(value: unknown): NearEarthObject {
  const raw = record(value);
  if (
    typeof raw.id !== "string" ||
    !/^\d+$/.test(raw.id) ||
    typeof raw.name !== "string" ||
    !raw.name.trim() ||
    typeof raw.is_potentially_hazardous_asteroid !== "boolean" ||
    !Array.isArray(raw.close_approach_data)
  )
    throw new Error(
      "Malformed NASA NeoWs response: incomplete object metadata.",
    );
  let diameter: NearEarthObject["estimatedDiameterMeters"];
  if (raw.estimated_diameter) {
    const meters = record(record(raw.estimated_diameter).meters);
    const min = nonnegative(meters.estimated_diameter_min);
    const max = nonnegative(meters.estimated_diameter_max);
    if (min !== undefined && max !== undefined) {
      if (min > max)
        throw new Error(
          "Malformed NASA NeoWs response: inverted diameter range.",
        );
      diameter = { min, max };
    }
  }
  // Drop raw provider links (which can contain API keys); only allow JPL's public URL.
  let nasaJplUrl: string | undefined;
  if (typeof raw.nasa_jpl_url === "string") {
    try {
      const url = new URL(raw.nasa_jpl_url);
      if (url.hostname === "ssd.jpl.nasa.gov" && url.protocol === "https:")
        nasaJplUrl = url.href;
    } catch {
      /* Optional link. */
    }
  }
  return {
    id: `neo:${raw.id}`,
    nasaId: raw.id,
    name: raw.name.trim(),
    nasaJplUrl,
    absoluteMagnitude: number(raw.absolute_magnitude_h),
    estimatedDiameterMeters: diameter,
    potentiallyHazardous: raw.is_potentially_hazardous_asteroid,
    closeApproaches: raw.close_approach_data.map(approach),
  };
}
export function normalizeFeed(
  payload: unknown,
  window: DiscoveryWindow,
): NearEarthObject[] {
  const groups = record(record(payload).near_earth_objects);
  const objects = new Map<string, NearEarthObject>();
  const start = parseDate(window.start),
    end = parseDate(window.end) + DAY;
  for (const rows of Object.values(groups)) {
    if (!Array.isArray(rows))
      throw new Error("Malformed NASA NeoWs response: invalid date group.");
    for (const row of rows) {
      const neo = normalize(row);
      neo.closeApproaches = neo.closeApproaches.filter(
        (a) => a.orbitingBody === "Earth" && a.time >= start && a.time < end,
      );
      if (!neo.closeApproaches.length) continue;
      const prior = objects.get(neo.id);
      const merged = [
        ...(prior?.closeApproaches ?? []),
        ...neo.closeApproaches,
      ];
      neo.closeApproaches = [
        ...new Map(
          merged.map((a) => [`${a.time}:${a.orbitingBody}`, a]),
        ).values(),
      ].sort((a, b) => a.time - b.time);
      objects.set(neo.id, neo);
    }
  }
  return [...objects.values()];
}
