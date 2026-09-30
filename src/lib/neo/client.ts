import type { DiscoveryResult } from "../../models/neo";
import type {
  ObjectId,
  SpaceObjectTrajectory,
  TimeRange,
} from "../../models/trajectory";
import { AsyncCache } from "../cache/asyncCache";
import { utcDate } from "../astronomy/time";
const discoveryCache = new AsyncCache<DiscoveryResult>(Infinity, 32);
const trajectoryCache = new AsyncCache<SpaceObjectTrajectory>(Infinity, 64);
async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const payload: unknown = await response.json();
  if (!response.ok)
    throw new Error(
      payload &&
        typeof payload === "object" &&
        "error" in payload &&
        typeof payload.error === "string"
        ? payload.error
        : "The data service is unavailable. Please retry later.",
    );
  return payload as T;
}
export function loadDiscovery(date: string): Promise<DiscoveryResult> {
  return discoveryCache.get(date, () =>
    getJson<DiscoveryResult>(`/api/discovery?${new URLSearchParams({ date })}`),
  );
}
export function loadNeoTrajectory(
  id: ObjectId,
  date: string,
  range: TimeRange,
): Promise<SpaceObjectTrajectory> {
  const key = `${id}:${range.start}:${range.end}`;
  return trajectoryCache.get(key, () =>
    getJson<SpaceObjectTrajectory>(
      `/api/neo-trajectory?${new URLSearchParams({ id, date, start: utcDate(range.start), end: utcDate(range.end) })}`,
    ),
  );
}
