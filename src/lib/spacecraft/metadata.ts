import type { MissionMetadata, Spacecraft } from "../../models/spacecraft";
import { AsyncCache } from "../cache/asyncCache";
/** Curated facts reviewed against the cited NASA profiles; no webpage polling or live-status claim. */
const records: Record<string, MissionMetadata> = {
  "Voyager 1": {
    mission: "Voyager Interstellar Mission",
    agency: "NASA / JPL",
    launchDate: "1977-09-05",
    missionStatus: "Extended mission (profile snapshot)",
    description:
      "Jupiter and Saturn flyby mission continuing into interstellar space.",
    reviewedAt: "2026-10-03",
    events: [
      { date: "1977-09-05", precision: "day", label: "Launch", type: "launch" },
      {
        date: "1979-03-05",
        precision: "day",
        label: "Jupiter flyby",
        type: "flyby",
      },
      {
        date: "1980-11-12",
        precision: "day",
        label: "Saturn flyby",
        type: "flyby",
      },
      {
        date: "2012-08-25",
        precision: "day",
        label: "Entered interstellar space",
        type: "milestone",
      },
    ],
    sources: [
      {
        name: "NASA Voyager 1 mission profile",
        url: "https://science.nasa.gov/mission/voyager/voyager-1/",
      },
    ],
  },
  "Voyager 2": {
    mission: "Voyager Interstellar Mission",
    agency: "NASA / JPL",
    launchDate: "1977-08-20",
    missionStatus: "Extended mission (profile snapshot)",
    description:
      "Explored the four giant planets before entering interstellar space.",
    reviewedAt: "2026-10-03",
    events: [
      { date: "1977-08-20", precision: "day", label: "Launch", type: "launch" },
      {
        date: "1979-07-09",
        precision: "day",
        label: "Jupiter flyby",
        type: "flyby",
      },
      {
        date: "1986-01-24",
        precision: "day",
        label: "Uranus flyby",
        type: "flyby",
      },
      {
        date: "1989-08-25",
        precision: "day",
        label: "Neptune flyby",
        type: "flyby",
      },
      {
        date: "2018-11-25",
        precision: "day",
        label: "Entered interstellar space",
        type: "milestone",
      },
    ],
    sources: [
      {
        name: "NASA Voyager 2 mission profile",
        url: "https://science.nasa.gov/mission/voyager/voyager-2/",
      },
    ],
  },
  "New Horizons": {
    mission: "New Horizons",
    agency: "NASA / Johns Hopkins APL",
    launchDate: "2006-01-19",
    description: "Pluto and Kuiper Belt exploration.",
    reviewedAt: "2026-10-03",
    events: [
      { date: "2006-01-19", precision: "day", label: "Launch", type: "launch" },
      {
        date: "2007-02-28",
        precision: "day",
        label: "Jupiter gravity assist",
        type: "flyby",
      },
      {
        date: "2015-07-14",
        precision: "day",
        label: "Pluto flyby",
        type: "flyby",
      },
      {
        date: "2019-01-01",
        precision: "day",
        label: "Arrokoth flyby",
        type: "flyby",
      },
    ],
    sources: [
      {
        name: "NASA New Horizons mission profile",
        url: "https://science.nasa.gov/mission/new-horizons/",
      },
    ],
  },
  Cassini: {
    mission: "Cassini-Huygens",
    agency: "NASA / ESA / ASI",
    launchDate: "1997-10-15",
    missionStatus: "Mission ended 2017-09-15",
    reviewedAt: "2026-10-03",
    events: [
      { date: "1997-10-15", precision: "day", label: "Launch", type: "launch" },
      {
        date: "2017-09-15",
        precision: "day",
        label: "Mission end",
        type: "mission-end",
      },
    ],
    sources: [
      {
        name: "NASA Cassini mission profile",
        url: "https://science.nasa.gov/mission/cassini/",
      },
    ],
  },
  Galileo: {
    mission: "Galileo",
    agency: "NASA / JPL",
    launchDate: "1989-10-18",
    missionStatus: "Mission ended 2003-09-21",
    reviewedAt: "2026-10-03",
    events: [
      { date: "1989-10-18", precision: "day", label: "Launch", type: "launch" },
      {
        date: "2003-09-21",
        precision: "day",
        label: "Mission end",
        type: "mission-end",
      },
    ],
    sources: [
      {
        name: "NASA Galileo mission profile",
        url: "https://science.nasa.gov/mission/galileo/",
      },
    ],
  },
  Juno: {
    mission: "Juno",
    agency: "NASA / JPL",
    launchDate: "2011-08-05",
    description: "Exploration of the Jovian system.",
    reviewedAt: "2026-10-03",
    events: [
      { date: "2011-08-05", precision: "day", label: "Launch", type: "launch" },
    ],
    sources: [
      {
        name: "NASA Juno mission profile",
        url: "https://science.nasa.gov/mission/juno/",
      },
    ],
  },
};
export interface SpacecraftDataProvider {
  id: string;
  freshnessMs: number;
  supports(spacecraft: Spacecraft): boolean;
  getMetadata(spacecraft: Spacecraft): Promise<MissionMetadata | undefined>;
  /** Optional engineering/science feed. No implementation is registered today. */
  getTelemetry?: (
    spacecraft: Spacecraft,
  ) => Promise<{
    observedAt: string;
    source: string;
    measurements: Record<string, { value: number; unit: string }>;
  }>;
}
const curated: SpacecraftDataProvider = {
  id: "nasa-mission-profiles",
  freshnessMs: 86400000,
  supports: (s) => Object.hasOwn(records, s.name),
  getMetadata: async (s) => records[s.name],
};
export const spacecraftProviders: SpacecraftDataProvider[] = [curated];
export const selectMetadataProvider = (spacecraft: Spacecraft) =>
  spacecraftProviders.find((p) => p.supports(spacecraft));
export const telemetryAvailable = (spacecraft: Spacecraft) =>
  spacecraftProviders.some((p) => p.supports(spacecraft) && !!p.getTelemetry);
const metadataCache = new AsyncCache<MissionMetadata | undefined>(86400000, 64);
export function getMissionMetadata(spacecraft: Spacecraft) {
  const provider = selectMetadataProvider(spacecraft);
  return provider
    ? metadataCache.get(`${provider.id}:${spacecraft.id}`, () =>
        provider.getMetadata(spacecraft),
      )
    : Promise.resolve(undefined);
}
/** Names aid discoverability only. Every identity must be resolved by lookup. */
export const SPACECRAFT_CATALOG = [
  "Voyager 1",
  "Voyager 2",
  "New Horizons",
  "Cassini",
  "Galileo",
  "Juno",
];
