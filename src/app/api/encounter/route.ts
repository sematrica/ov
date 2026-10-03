import { NextResponse } from "next/server";
import { discoverNeos } from "@/lib/neows/service";
import { parseDate } from "@/lib/neows/window";
import { resolveHorizonsTarget } from "@/lib/jpl/resolver";
import { EARTH, MOON, getEncounterTrajectory } from "@/lib/jpl/horizons";
import {
  encounterWindow,
  ENCOUNTER_STEP_MINUTES,
} from "@/lib/astronomy/encounter";
import type { EncounterDataset } from "@/models/encounter";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("id") ?? "",
    date = params.get("date") ?? "",
    epoch = params.get("time");
  const time = Number(epoch);
  try {
    parseDate(date);
    if (!/^neo:\d+$/.test(id) || !epoch || !Number.isFinite(time))
      throw new Error();
    encounterWindow(time);
  } catch {
    return NextResponse.json(
      { error: "Invalid encounter object, date, or timestamp." },
      { status: 400 },
    );
  }
  try {
    const discovery = await discoverNeos(date);
    const neo = discovery.objects.find((n) => n.id === id);
    const approach = neo?.closeApproaches.find(
      (a) => a.time === time && a.orbitingBody === "Earth",
    );
    if (!neo || !approach)
      return NextResponse.json(
        {
          error: "No matching Earth close-approach metadata. Reload discovery.",
        },
        { status: 404 },
      );
    const range = encounterWindow(time);
    const load = async (
      target: Parameters<typeof getEncounterTrajectory>[0],
    ) => {
      try {
        return await getEncounterTrajectory(
          target,
          range,
          ENCOUNTER_STEP_MINUTES,
        );
      } catch (error) {
        throw new Error(
          `${target.name} ephemeris: ${error instanceof Error ? error.message : "request failed"}`,
        );
      }
    };
    const asteroid = await load(resolveHorizonsTarget(neo));
    const earth = await load(EARTH);
    let moon: EncounterDataset["moon"], moonError: string | undefined;
    try {
      moon = await load(MOON);
    } catch (error) {
      moonError =
        error instanceof Error ? error.message : "Moon ephemeris unavailable.";
    }
    return NextResponse.json({
      neo,
      approach,
      range,
      stepMinutes: ENCOUNTER_STEP_MINUTES,
      asteroid,
      earth,
      moon,
      moonError,
    } satisfies EncounterDataset);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to prepare encounter.",
      },
      { status: 502 },
    );
  }
}
