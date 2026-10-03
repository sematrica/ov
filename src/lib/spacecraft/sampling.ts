import type { TimeRange } from "../../models/trajectory";
import { DAY } from "../astronomy/time";
/** Hourly for short inspections; six-hour cruise samples for longer windows. */
export function spacecraftCadence(range: TimeRange) {
  return range.end - range.start <= 7 * DAY ? 60 : 360;
}
