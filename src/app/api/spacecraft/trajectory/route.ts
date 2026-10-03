import { NextResponse } from "next/server";
import { loadSpacecraftTrajectory } from "@/lib/spacecraft/service";
import { parseDate } from "@/lib/neows/window";
import { DAY } from "@/lib/astronomy/time";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const id = p.get("id") ?? "";
  let start: number, end: number;
  try {
    start = parseDate(p.get("start") ?? "");
    end = parseDate(p.get("end") ?? "");
    if (!/^-[1-9]\d*$/.test(id) || end <= start || end - start > 366 * DAY)
      throw new Error();
  } catch {
    return NextResponse.json(
      {
        error:
          "Choose a resolved spacecraft and a 1–366 day range between 1900 and 2100.",
      },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(
      await loadSpacecraftTrajectory(id, { start, end }),
    );
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Spacecraft trajectory unavailable.",
      },
      { status: 502 },
    );
  }
}
