import type { TimeRange } from "../../models/trajectory";
export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
/** A fixed ±365-day window, aligned to UTC midnight for reusable daily caching. */
export function initialRange(now = Date.now()): TimeRange {
  if (!Number.isFinite(now)) throw new Error("Invalid current date.");
  const midnight = Math.floor(now / DAY) * DAY;
  return { start: midnight - 365 * DAY, end: midnight + 366 * DAY };
}
export function clampTime(time: number, range: TimeRange): number {
  if (
    !Number.isFinite(time) ||
    !Number.isFinite(range.start) ||
    !Number.isFinite(range.end) ||
    range.start >= range.end
  ) {
    throw new Error("Invalid simulation time or range.");
  }
  return Math.max(range.start, Math.min(range.end, time));
}
export function advanceTime(
  time: number,
  elapsedMs: number,
  rate: number,
  range: TimeRange,
): number {
  return clampTime(time + elapsedMs * rate, range);
}
export function utcDate(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}
export function formatDate(time: number): string {
  return new Date(time).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
