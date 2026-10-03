import { NextResponse } from "next/server";
import { getPlanetTrajectory } from "@/lib/jpl/horizons";
import { parseDate } from "@/lib/neows/window";
import { DAY } from "@/lib/astronomy/time";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  let start: number, end: number;
  try {
    start = parseDate(p.get("start") ?? "");
    end = parseDate(p.get("end") ?? "");
    if (end <= start || end - start > 732 * DAY) throw new Error();
  } catch {
    return NextResponse.json(
      { error: "Invalid planetary time range." },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(
      await getPlanetTrajectory(p.get("id") ?? "", { start, end }),
    );
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Planet ephemeris unavailable.",
      },
      { status: 502 },
    );
  }
}
