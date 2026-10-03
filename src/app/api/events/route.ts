import { NextResponse } from "next/server";
import { discoverNeoWindow, NeoWsError } from "@/lib/neows/service";
import {
  splitDateRange,
  normalizeEvents,
  deduplicateEvents,
  type EventResult,
} from "@/lib/explorer/events";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  let windows: ReturnType<typeof splitDateRange>;
  try {
    windows = splitDateRange(p.get("start") ?? "", p.get("end") ?? "");
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid range." },
      { status: 400 },
    );
  }
  const result: EventResult = { events: [], failures: [] };
  for (let i = 0; i < windows.length; i++) {
    const window = windows[i];
    try {
      const data = await discoverNeoWindow(window);
      result.events.push(...normalizeEvents(data.objects));
    } catch (e) {
      const error = e instanceof Error ? e.message : "Discovery failed";
      result.failures.push({ window, error });
      if (e instanceof NeoWsError && (e.status === 429 || e.status === 503)) {
        for (const skipped of windows.slice(i + 1))
          result.failures.push({
            window: skipped,
            error:
              "Not requested after provider limit or configuration failure.",
          });
        break;
      }
    }
  }
  result.events = deduplicateEvents(result.events);
  return NextResponse.json(result);
}
