import { NextResponse } from "next/server";
import { HorizonsSpacecraftSearchService } from "@/lib/spacecraft/service";
import { normalizeSpacecraftQuery } from "@/lib/spacecraft/lookup";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  try {
    normalizeSpacecraftQuery(query);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid query." },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json({
      results: await new HorizonsSpacecraftSearchService().records(query),
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Spacecraft lookup unavailable.",
      },
      { status: 502 },
    );
  }
}
