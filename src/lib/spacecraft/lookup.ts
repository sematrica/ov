import type { Spacecraft } from "../../models/spacecraft";
import type { HorizonsTarget } from "../jpl/resolver";
export function normalizeSpacecraftQuery(query: string) {
  const normalized = query.trim().replace(/\s+/g, " ");
  if (
    !normalized ||
    normalized.length > 80 ||
    !/^[\w /'.!=|\-]+$/.test(normalized)
  )
    throw new Error(
      "Enter a spacecraft name, designation, or Horizons ID (up to 80 characters).",
    );
  return normalized;
}
export function normalizeSpacecraftLookup(payload: unknown): Spacecraft[] {
  if (!payload || typeof payload !== "object")
    throw new Error("Invalid Horizons lookup response.");
  const p = payload as Record<string, unknown>;
  const signature = p.signature as Record<string, unknown> | undefined;
  if (
    signature?.version !== "1.1" ||
    !String(signature.source).includes("Horizons Lookup")
  )
    throw new Error("Unsupported Horizons lookup response version.");
  if (
    p.count === undefined ||
    !Number.isInteger(Number(p.count)) ||
    Number(p.count) < 0
  )
    throw new Error("Invalid Horizons result count.");
  if (Number(p.count) === 0) return [];
  if (!Array.isArray(p.result) || p.result.length !== Number(p.count))
    throw new Error("Incomplete Horizons spacecraft results.");
  const results = p.result.map((raw: unknown): Spacecraft => {
    if (!raw || typeof raw !== "object")
      throw new Error("Malformed spacecraft match.");
    const row = raw as Record<string, unknown>;
    if (
      row.type !== "spacecraft" ||
      typeof row.name !== "string" ||
      !row.name.trim() ||
      !/^-[1-9]\d*$/.test(String(row.spkid)) ||
      !Array.isArray(row.alias) ||
      row.alias.some((a) => typeof a !== "string")
    )
      throw new Error("Unexpected spacecraft identity returned by Horizons.");
    return {
      id: `spacecraft:${row.spkid}`,
      type: "spacecraft",
      horizonsId: String(row.spkid),
      name: row.name.replace(/\s*\(spacecraft\)\s*$/i, "").trim(),
      designation: typeof row.pdes === "string" ? row.pdes : undefined,
      aliases: row.alias as string[],
      trajectoryAvailable: true,
      telemetryAvailable: false,
    };
  });
  return [...new Map(results.map((s) => [s.id, s])).values()];
}
export function resolveSpacecraftId(matches: Spacecraft[], id: string) {
  const match = matches.filter((s) => s.horizonsId === id);
  if (match.length !== 1)
    throw new Error(
      "No unique spacecraft matches this Horizons ID. Search again and choose a result.",
    );
  return match[0];
}
export function spacecraftTarget(spacecraft: Spacecraft): HorizonsTarget {
  if (!/^-[1-9]\d*$/.test(spacecraft.horizonsId))
    throw new Error("Invalid spacecraft identifier.");
  return {
    id: spacecraft.id,
    name: spacecraft.name,
    command: spacecraft.horizonsId,
    identity: new RegExp(`\\(${spacecraft.horizonsId}\\)(?:\\s|$)`),
  };
}
