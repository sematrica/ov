import { parseDate } from "../neows/window";
import { bodyMetadata, normalizeSearch } from "./catalog";
export interface ExplorerLink {
  date?: string;
  object?: string;
  mode: "solar" | "encounter";
  event?: number;
}
export function parseExplorerLink(params: URLSearchParams): ExplorerLink {
  const date = params.get("date") ?? undefined;
  if (date) parseDate(date);
  const raw = params.get("object") ?? undefined;
  const object = raw ? normalizeSearch(raw) : undefined;
  if (
    object &&
    !bodyMetadata(object) &&
    !/^neo:\d+$/.test(object) &&
    !/^spacecraft:-[1-9]\d*$/.test(object) &&
    !/^\d{1,9}$/.test(object) &&
    !["apophis", "bennu"].includes(object) &&
    !/^\d{4} [a-z]{2}\d*$/.test(object)
  )
    throw new Error(
      "Invalid object in link. Search the current discovery or Event Explorer.",
    );
  const mode = params.get("mode") ?? "solar";
  if (mode !== "solar" && mode !== "encounter")
    throw new Error("Invalid visualization mode.");
  const epoch = params.get("event");
  const event = epoch === null ? undefined : Number(epoch);
  if (
    event !== undefined &&
    (!Number.isFinite(event) || !Number.isFinite(new Date(event).getTime()))
  )
    throw new Error("Invalid event timestamp.");
  return { date, object, mode, event };
}
export function explorerUrl(state: ExplorerLink) {
  const p = new URLSearchParams();
  if (state.date) p.set("date", state.date);
  if (state.object) p.set("object", state.object);
  p.set("mode", state.mode);
  if (state.event !== undefined) p.set("event", String(state.event));
  return `/?${p}`;
}
