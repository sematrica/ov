"use client";
import { useRef, useState } from "react";
import type { NeoEntry } from "@/models/neo";
import type { EncounterDataset } from "@/models/encounter";
import { closestApproach } from "@/lib/neo/selection";
import {
  encounterCacheKey,
  encounterWindow,
  earthRelativeTrajectory,
  interpolateState,
} from "@/lib/astronomy/encounter";
import { AsyncCache } from "@/lib/cache/asyncCache";
const cache = new AsyncCache<EncounterDataset>(6 * 3600000, 12);
export function useEncounter() {
  const [data, setData] = useState<EncounterDataset>();
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const request = useRef(0);
  async function load(
    entry: NeoEntry,
    enter: (data: EncounterDataset) => void,
    eventTime?: number,
    mode: "solar" | "encounter" = "encounter",
  ) {
    let partial: EncounterDataset | undefined;
    const token = ++request.current;
    setLoading(true);
    setError(undefined);
    try {
      const approach = closestApproach({
        ...entry.metadata,
        closeApproaches: entry.metadata.closeApproaches.filter(
          (a) =>
            a.orbitingBody === "Earth" &&
            Number.isFinite(a.time) &&
            (eventTime === undefined || a.time === eventTime),
        ),
      });
      if (!approach)
        throw new Error(
          "No valid Earth close-approach metadata for this asteroid.",
        );
      const key = encounterCacheKey(
        entry.metadata.id,
        encounterWindow(approach.time),
      );
      const result = await cache
        .get(key, async () => {
          const params = new URLSearchParams({
            id: entry.metadata.id,
            date: entry.discoveryDate,
            time: String(approach.time),
          });
          const response = await fetch(`/api/encounter?${params}`);
          const body = await response.json();
          if (!response.ok)
            throw new Error(body.error ?? "Unable to prepare encounter.");
          const dataset = body as EncounterDataset;
          for (const trajectory of [
            dataset.earth,
            dataset.asteroid,
            ...(dataset.moon ? [dataset.moon] : []),
          ]) {
            interpolateState(trajectory.points, dataset.range.start);
            interpolateState(trajectory.points, dataset.range.end);
          }
          earthRelativeTrajectory(
            dataset.asteroid.points,
            dataset.earth.points,
          );
          if (dataset.moon)
            earthRelativeTrajectory(dataset.moon.points, dataset.earth.points);
          // Allow retry of a failed Moon request; never cache partial failures.
          if (dataset.moonError) {
            partial = dataset;
            throw new Error(dataset.moonError);
          }
          return dataset;
        })
        .catch((error) => {
          if (partial) return partial;
          throw error;
        });
      if (token !== request.current) return;
      setData(result);
      enter(result);
      setActive(mode === "encounter");
    } catch (error) {
      if (token === request.current)
        setError(
          error instanceof Error
            ? error.message
            : "Unable to prepare encounter.",
        );
    } finally {
      if (token === request.current) setLoading(false);
    }
  }
  function exit() {
    request.current++;
    setLoading(false);
    setActive(false);
    setError(undefined);
  }
  return { data, active, loading, error, load, exit };
}
