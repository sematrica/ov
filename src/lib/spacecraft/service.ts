import "server-only";
import { AsyncCache } from "../cache/asyncCache";
import {
  jplQueue,
  getSpacecraftTrajectory,
  getPlanetTrajectory,
} from "../jpl/horizons";
import {
  normalizeSpacecraftLookup,
  normalizeSpacecraftQuery,
  resolveSpacecraftId,
  spacecraftTarget,
} from "./lookup";
import { getMissionMetadata, telemetryAvailable } from "./metadata";
import { PROVIDERS } from "../providers/registry";
import type {
  Spacecraft,
  SpacecraftRecord,
  SpacecraftTrajectoryResult,
} from "../../models/spacecraft";
import type { TimeRange } from "../../models/trajectory";
import { spacecraftCadence } from "./sampling";
const lookupCache = new AsyncCache<Spacecraft[]>(86400000, 128);
export class HorizonsSpacecraftSearchService {
  async search(query: string): Promise<Spacecraft[]> {
    const q = normalizeSpacecraftQuery(query);
    return lookupCache.get(q.toLowerCase(), () =>
      jplQueue.run(async () => {
        let response: Response;
        try {
          response = await fetch(
            `${PROVIDERS.spacecraftLookup.endpoint}?${new URLSearchParams({ sstr: q, group: "sct", format: "json" })}`,
            { cache: "no-store", signal: AbortSignal.timeout(30000) },
          );
        } catch {
          throw new Error(
            "Horizons spacecraft lookup is unavailable. Please retry.",
          );
        }
        if (!response.ok)
          throw new Error(
            `Horizons spacecraft lookup is unavailable (HTTP ${response.status}).`,
          );
        return normalizeSpacecraftLookup(await response.json());
      }),
    );
  }
  async records(query: string): Promise<SpacecraftRecord[]> {
    const matches = await this.search(query);
    return Promise.all(
      matches.map(async (spacecraft) => {
        try {
          return {
            spacecraft: {
              ...spacecraft,
              telemetryAvailable: telemetryAvailable(spacecraft),
            },
            metadata: await getMissionMetadata(spacecraft),
          };
        } catch {
          return { spacecraft, metadataError: "Mission metadata unavailable." };
        }
      }),
    );
  }
}
export async function loadSpacecraftTrajectory(
  id: string,
  range: TimeRange,
): Promise<SpacecraftTrajectoryResult> {
  const spacecraft = resolveSpacecraftId(
    await new HorizonsSpacecraftSearchService().search(id),
    id,
  );
  const stepMinutes = spacecraftCadence(range);
  const trajectory = await getSpacecraftTrajectory(
    spacecraftTarget(spacecraft),
    range,
    stepMinutes,
  );
  let earth: SpacecraftTrajectoryResult["earth"],
    earthError: string | undefined;
  try {
    earth = await getPlanetTrajectory("earth", range);
  } catch {
    earthError =
      "Earth ephemeris unavailable for this range; Earth distance cannot be calculated.";
  }
  return { trajectory, earth, earthError, range, stepMinutes };
}
