import "server-only";
import type {
  ObjectId,
  SpaceObjectTrajectory,
  TrajectoryDataset,
  TimeRange,
} from "../../models/trajectory";
import { initialRange, utcDate } from "../astronomy/time";
import { extractResult, HorizonsError, parseVectors } from "./parser";
const ENDPOINT = "https://ssd.jpl.nasa.gov/api/horizons.api";
const TARGETS: {
  id: ObjectId;
  name: string;
  command: string;
  identity: RegExp;
}[] = [
  { id: "earth", name: "Earth", command: "399", identity: /^Earth\s*\(399\)/ },
  // Exact provisional designation verified against JPL: 99942 Apophis (2004 MN4).
  {
    id: "apophis",
    name: "99942 Apophis",
    command: "DES=2004 MN4;",
    identity: /^99942 Apophis\s*\(2004 MN4\)/,
  },
];
export class HorizonsService {
  async trajectory(
    target: (typeof TARGETS)[number],
    range: TimeRange,
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
      START_TIME: utcDate(range.start),
      STOP_TIME: utcDate(range.end),
      STEP_SIZE: "6 h",
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
    for (const target of TARGETS)
      objects.push(await this.trajectory(target, range));
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
export function getTrajectories(): Promise<TrajectoryDataset> {
  const range = initialRange();
  const key = utcDate(range.start);
  if (cached?.key === key && cached.expires > Date.now()) return cached.promise;
  const promise = new HorizonsService().dataset(range);
  cached = { key, expires: Date.now() + 6 * 3_600_000, promise };
  void promise.catch(() => {
    if (cached?.promise === promise) cached = undefined;
  });
  return promise;
}
