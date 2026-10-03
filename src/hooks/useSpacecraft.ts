"use client";
import { useRef, useState } from "react";
import type {
  SpacecraftEntry,
  SpacecraftRecord,
  SpacecraftTrajectoryResult,
} from "@/models/spacecraft";
import type { ObjectId, TimeRange } from "@/models/trajectory";
import { AsyncCache } from "@/lib/cache/asyncCache";
import { utcDate } from "@/lib/astronomy/time";
import { trajectoryCacheKey } from "@/lib/jpl/cacheKey";
import { spacecraftCadence } from "@/lib/spacecraft/sampling";
import { coversTime } from "@/lib/spacecraft/measurements";
const cache = new AsyncCache<SpacecraftTrajectoryResult>(6 * 3600000, 24);
async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  const d = await r.json();
  if (!r.ok) throw new Error(d.error ?? "Spacecraft service unavailable.");
  return d;
}
export function useSpacecraft() {
  const [results, setResults] = useState<SpacecraftRecord[]>([]);
  const [entries, setEntries] = useState<
    Partial<Record<ObjectId, SpacecraftEntry>>
  >({});
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string>();
  const version = useRef(0);
  const tokens = useRef(new Map<ObjectId, number>());
  async function search(query: string) {
    const token = ++version.current;
    setSearching(true);
    setSearchError(undefined);
    try {
      const result = await getJson<{ results: SpacecraftRecord[] }>(
        `/api/spacecraft/search?${new URLSearchParams({ q: query })}`,
      );
      if (token === version.current) setResults(result.results);
      return result.results;
    } catch (e) {
      if (token === version.current)
        setSearchError(
          e instanceof Error ? e.message : "Spacecraft lookup unavailable.",
        );
      return [];
    } finally {
      if (token === version.current) setSearching(false);
    }
  }
  function select(record: SpacecraftRecord) {
    setEntries((s) => ({
      ...s,
      [record.spacecraft.id]: s[record.spacecraft.id] ?? {
        ...record,
        status: "discovered",
        visible: false,
        showTrajectory: true,
      },
    }));
  }
  async function add(
    record: SpacecraftRecord,
    range: TimeRange,
    onReady: (data: SpacecraftTrajectoryResult) => void,
  ) {
    const id = record.spacecraft.id;
    const token = (tokens.current.get(id) ?? 0) + 1;
    tokens.current.set(id, token);
    setEntries((s) => ({
      ...s,
      [id]: {
        ...record,
        ...s[id],
        status: "loading",
        error: undefined,
        visible: s[id]?.visible ?? false,
        showTrajectory: s[id]?.showTrajectory ?? true,
      },
    }));
    try {
      const key = trajectoryCacheKey(
        id,
        range,
        spacecraftCadence(range),
        "spacecraft",
      );
      let partial: SpacecraftTrajectoryResult | undefined;
      const result = await cache
        .get(key, async () => {
          const d = await getJson<SpacecraftTrajectoryResult>(
            `/api/spacecraft/trajectory?${new URLSearchParams({ id: record.spacecraft.horizonsId, start: utcDate(range.start), end: utcDate(range.end) })}`,
          );
          if (
            d.trajectory.id !== id ||
            !coversTime(d.trajectory, range.start) ||
            !coversTime(d.trajectory, range.end)
          )
            throw new Error("Spacecraft trajectory has insufficient coverage.");
          if (d.earthError) {
            partial = d;
            throw new Error(d.earthError);
          }
          return d;
        })
        .catch((e) => {
          if (partial) return partial;
          throw e;
        });
      if (tokens.current.get(id) !== token) return;
      setEntries((s) => ({
        ...s,
        [id]: {
          ...record,
          status: "loaded",
          data: result,
          visible: true,
          showTrajectory: s[id]?.showTrajectory ?? true,
        },
      }));
      onReady(result);
    } catch (e) {
      if (tokens.current.get(id) === token)
        setEntries((s) => ({
          ...s,
          [id]: {
            ...record,
            ...s[id],
            status: "error",
            error:
              e instanceof Error
                ? e.message
                : "Spacecraft trajectory unavailable.",
            visible: s[id]?.visible ?? false,
            showTrajectory: s[id]?.showTrajectory ?? true,
          },
        }));
    }
  }
  function toggle(id: ObjectId, key: "visible" | "showTrajectory") {
    setEntries((s) => {
      const e = s[id];
      return e ? { ...s, [id]: { ...e, [key]: !e[key] } } : s;
    });
  }
  function remove(id: ObjectId) {
    tokens.current.set(id, (tokens.current.get(id) ?? 0) + 1);
    setEntries((s) => {
      const next = { ...s };
      delete next[id];
      return next;
    });
  }
  return {
    entries,
    results,
    searching,
    searchError,
    search,
    select,
    add,
    toggle,
    remove,
  };
}
