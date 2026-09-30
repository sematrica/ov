import { DAY, utcDate } from "../astronomy/time";
import type { DiscoveryWindow } from "../../models/neo";
export const DISCOVERY_RADIUS_DAYS = 1;
export function parseDate(date: string): number {
  const time = Date.parse(`${date}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(time) ||
    utcDate(time) !== date ||
    date < "1900-01-01" ||
    date > "2100-12-31"
  ) {
    throw new Error("Choose a valid date between 1900 and 2100.");
  }
  return time;
}
export function discoveryWindow(
  date: string,
  radius = DISCOVERY_RADIUS_DAYS,
): DiscoveryWindow {
  if (!Number.isInteger(radius) || radius < 0 || radius > 3)
    throw new Error("NeoWs windows must span at most seven days.");
  const center = parseDate(date);
  return {
    start: utcDate(center - radius * DAY),
    end: utcDate(center + radius * DAY),
  };
}
