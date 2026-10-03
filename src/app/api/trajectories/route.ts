import { parseDate } from "@/lib/neows/window";
import { NextResponse } from "next/server";
import { getTrajectories } from "@/lib/jpl/horizons";
import { HorizonsError } from "@/lib/jpl/parser";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  let epoch: number | undefined;
  try {
    const date = new URL(request.url).searchParams.get("date");
    if (date) epoch = parseDate(date);
  } catch {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }
  try {
    return NextResponse.json(await getTrajectories(epoch), {
      headers: { "Cache-Control": "private, max-age=3600" },
    });
  } catch (error) {
    console.error("Horizons request failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof HorizonsError
            ? error.message
            : "Unable to retrieve JPL Horizons data. Please retry.",
      },
      { status: 502 },
    );
  }
}
