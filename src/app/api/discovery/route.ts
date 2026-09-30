import { NextResponse } from "next/server";
import { discoverNeos, NeoWsError } from "@/lib/neows/service";
import { parseDate } from "@/lib/neows/window";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date") ?? "";
  try {
    parseDate(date);
  } catch {
    return NextResponse.json(
      { error: "Choose a valid discovery date." },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(await discoverNeos(date), {
      headers: { "Cache-Control": "private, max-age=3600" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof NeoWsError
            ? error.message
            : "Unable to retrieve NASA NeoWs data.",
      },
      { status: error instanceof NeoWsError ? error.status : 502 },
    );
  }
}
