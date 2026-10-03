/** Endpoint configuration belongs to the data layer. Metadata snapshots are not APIs. */
export const PROVIDERS = {
  horizons: {
    name: "NASA/JPL Horizons",
    purpose: "ephemeris",
    official: true,
    endpoint: "https://ssd.jpl.nasa.gov/api/horizons.api",
    documentation: "https://ssd-api.jpl.nasa.gov/doc/horizons.html",
  },
  spacecraftLookup: {
    name: "NASA/JPL Horizons Lookup",
    purpose: "identity",
    official: true,
    endpoint: "https://ssd.jpl.nasa.gov/api/horizons_lookup.api",
    documentation: "https://ssd-api.jpl.nasa.gov/doc/horizons_lookup.html",
  },
  neows: {
    name: "NASA NeoWs",
    purpose: "discovery",
    official: true,
    endpoint: "https://api.nasa.gov/neo/rest/v1/feed",
    documentation: "https://api.nasa.gov/",
  },
  missionProfiles: {
    name: "NASA mission profiles (curated snapshot)",
    purpose: "metadata",
    official: true,
    documentation: "https://science.nasa.gov/missions/",
  },
} as const;
