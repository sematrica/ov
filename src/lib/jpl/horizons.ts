import { PROVIDERS } from "../providers/registry";
import { trajectoryCacheKey } from "./cacheKey";
import { BODIES } from "../explorer/catalog";
import "server-only";
import { AsyncCache, SerialQueue } from "../cache/asyncCache";
import type { HorizonsTarget } from "./resolver";
import type {
  SpaceObjectTrajectory,
  TrajectoryDataset,
  TimeRange,
} from "../../models/trajectory";
import { initialRange, utcDate } from "../astronomy/time";
import { extractResult, HorizonsError, parseVectors } from "./parser";
const ENDPOINT = PROVIDERS.horizons.endpoint;
export const EARTH: HorizonsTarget = {
  id: "earth",
  name: "Earth",
  command: "399",
  identity: /^Earth\s*\(399\)/,
};
const trajectoryCache = new AsyncCache<SpaceObjectTrajectory>(
  6 * 3_600_000,
  64,
);
export const MOON: HorizonsTarget = {
  id: "moon",
  name: "Moon",
  command: "301",
  identity: /Moon\s*\(301\)/,
};
const encounterVectors = new AsyncCache<SpaceObjectTrajectory>(
  6 * 3_600_000,
  96,
);
export function getEncounterTrajectory(
  target: HorizonsTarget,
  range: TimeRange,
  minutes = 10,
) {
  return encounterVectors.get(
    trajectoryCacheKey(
      `${target.id}:${target.command}`,
      range,
      minutes,
      "encounter-high-resolution",
    ),
    () =>
      jplQueue.run(() =>
        new HorizonsService().trajectory(target, range, minutes),
      ),
  );
}
export const jplQueue = new SerialQueue();
export function getObjectTrajectory(
  target: HorizonsTarget,
  range: TimeRange,
): Promise<SpaceObjectTrajectory> {
  return trajectoryCache.get(
    trajectoryCacheKey(
      `${target.id}:${target.command}`,
      range,
      360,
      "long-range-asteroid",
    ),
    () => jplQueue.run(() => new HorizonsService().trajectory(target, range)),
  );
}
export class HorizonsService {
  async trajectory(
    target: HorizonsTarget,
    range: TimeRange,
    minutes?: number,
  ): Promise<SpaceObjectTrajectory> {
    const params = new URLSearchParams({ format: "json" });
    const options = {
      COMMAND: target.command,
      OBJ_DATA: "YES",
      MAKE_EPHEM: "YES",
      EPHEM_TYPE: "VECTORS",
      CENTER: "500@10",
      REF_PLANE: "ECLIPTIC",
      REF_SYSTEM: "ICRF",
      OUT_UNITS: "AU-D",
      VEC_TABLE: "2",
      VEC_CORR: "NONE",
      CSV_FORMAT: "YES",
      TIME_TYPE: "UT",
      START_TIME: minutes
        ? new Date(range.start).toISOString().slice(0, 16).replace("T", " ")
        : utcDate(range.start),
      STOP_TIME: minutes
        ? new Date(range.end).toISOString().slice(0, 16).replace("T", " ")
        : utcDate(range.end),
      STEP_SIZE: minutes ? `${minutes} min` : "6 h",
    };
    Object.entries(options).forEach(([key, value]) =>
      params.set(key, `'${value}'`),
    );
    let response: Response;
    try {
      response = await fetch(`${ENDPOINT}?${params}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(45_000),
      });
    } catch {
      throw new HorizonsError(
        "Unable to retrieve JPL Horizons data. The service may be unavailable; please retry.",
      );
    }
    if (!response.ok)
      throw new HorizonsError(
        `Unable to retrieve JPL Horizons data (HTTP ${response.status}).`,
      );
    const payload: unknown = await response.json();
    const parsed = parseVectors(extractResult(payload), target.identity);
    if (
      parsed.points[0].time > range.start ||
      parsed.points.at(-1)!.time < range.end
    ) {
      throw new HorizonsError(
        "JPL returned incomplete coverage for the requested time range.",
      );
    }
    return { id: target.id, name: target.name, ...parsed };
  }
  async dataset(range: TimeRange): Promise<TrajectoryDataset> {
    const objects: SpaceObjectTrajectory[] = [];
    // JPL asks clients to submit API requests sequentially.
    objects.push(await getObjectTrajectory(EARTH, range));
    return {
      range,
      objects,
      fetchedAt: new Date().toISOString(),
      source: "NASA/JPL Horizons",
      frame: "Heliocentric · J2000 ecliptic",
      units: "AU",
      timeScale: "UTC",
      stepHours: 6,
    };
  }
}
// Bounded single-window process cache + in-flight deduplication; failures are never cached.
let cached:
  | { key: string; expires: number; promise: Promise<TrajectoryDataset> }
  | undefined;
export function getTrajectories(date?: number): Promise<TrajectoryDataset> {
  const range = initialRange(date);
  const key = utcDate(range.start);
  if (cached?.key === key && cached.expires > Date.now()) return cached.promise;
  const promise = new HorizonsService().dataset(range);
  cached = { key, expires: Date.now() + 6 * 3_600_000, promise };
  void promise.catch(() => {
    if (cached?.promise === promise) cached = undefined;
  });
  return promise;
}

const planetCache = new AsyncCache<SpaceObjectTrajectory>(6 * 3600000, 64);
export function getPlanetTrajectory(id: string, range: TimeRange) {
  const body = BODIES.find((b) => b.id === id && b.type !== "star");
  if (!body) throw new HorizonsError("Unknown planet or Moon.");
  const target: HorizonsTarget = {
    id: body.id,
    name: body.name,
    command: body.horizonsId,
    identity: new RegExp(`^${body.name}\\s*\\(${body.horizonsId}\\)`),
  };
  return planetCache.get(
    trajectoryCacheKey(
      `${id}:${body.horizonsId}`,
      range,
      body.stepMinutes,
      "planet-wide",
    ),
    () =>
      jplQueue.run(() =>
        new HorizonsService().trajectory(target, range, body.stepMinutes),
      ),
  );
}

const spacecraftCache = new AsyncCache<SpaceObjectTrajectory>(6 * 3600000, 48);
export function getSpacecraftTrajectory(
  target: HorizonsTarget,
  range: TimeRange,
  minutes: number,
) {
  return spacecraftCache.get(
    trajectoryCacheKey(
      `${target.id}:${target.command}`,
      range,
      minutes,
      "spacecraft",
    ),
    () =>
      jplQueue.run(() =>
        new HorizonsService().trajectory(target, range, minutes),
      ),
  );
}
