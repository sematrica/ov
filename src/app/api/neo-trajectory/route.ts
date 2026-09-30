import { NextResponse } from "next/server";
import { discoverNeos, NeoWsError } from "@/lib/neows/service";
import { parseDate } from "@/lib/neows/window";
import { resolveHorizonsTarget } from "@/lib/jpl/resolver";
import { getObjectTrajectory } from "@/lib/jpl/horizons";
import { HorizonsError } from "@/lib/jpl/parser";
import { DAY } from "@/lib/astronomy/time";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("id") ?? "",
    date = params.get("date") ?? "";
  let start: number, end: number;
  try {
    parseDate(date);
    start = parseDate(params.get("start") ?? "");
    end = parseDate(params.get("end") ?? "");
    if (
      !/^neo:\d+$/.test(id) ||
      end <= start ||
      end - start > 732 * DAY ||
      parseDate(date) < start ||
      parseDate(date) > end
    )
      throw new Error();
  } catch {
    return NextResponse.json(
      { error: "Invalid object, discovery date, or trajectory range." },
      { status: 400 },
    );
  }
  try {
    // Resolve only canonical NASA metadata, never a browser-supplied JPL command.
    const discovery = await discoverNeos(date);
    const neo = discovery.objects.find((object) => object.id === id);
    if (!neo)
      return NextResponse.json(
        {
          error:
            "This object is not in the requested NASA discovery window. Load its discovery date again.",
        },
        { status: 404 },
      );
    const target = resolveHorizonsTarget(neo);
    return NextResponse.json(
      await getObjectTrajectory(target, { start, end }),
      { headers: { "Cache-Control": "private, max-age=3600" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof HorizonsError || error instanceof NeoWsError
            ? error.message
            : "Unable to retrieve this object's JPL Horizons trajectory.",
      },
      { status: error instanceof NeoWsError ? error.status : 502 },
    );
  }
}
