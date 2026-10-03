"use client";
import { trajectoryCacheKey } from "@/lib/jpl/cacheKey";
import { useEffect, useState } from "react";
import { BODIES } from "@/lib/explorer/catalog";
import type { SpaceObjectTrajectory, TimeRange } from "@/models/trajectory";
import { utcDate } from "@/lib/astronomy/time";
import { AsyncCache } from "@/lib/cache/asyncCache";
const cache = new AsyncCache<SpaceObjectTrajectory>(6 * 3600000, 64);
export function usePlanets(range: TimeRange) {
  const [objects, setObjects] = useState<Record<string, SpaceObjectTrajectory>>(
    {},
  );
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      for (const body of BODIES.filter(
        (b) => b.id !== "sun" && b.id !== "earth",
      )) {
        if (cancelled) return;
        setStatuses((s) => ({
          ...s,
          [body.id]: `Loading ${body.name} trajectory…`,
        }));
        try {
          const key = trajectoryCacheKey(
            body.id,
            range,
            body.stepMinutes,
            "planet-wide",
          );
          const result = await cache.get(key, async () => {
            const p = new URLSearchParams({
              id: body.id,
              start: utcDate(range.start),
              end: utcDate(range.end),
            });
            const r = await fetch(`/api/planet?${p}`);
            const d = await r.json();
            if (!r.ok) throw new Error(d.error ?? "Planet unavailable.");
            return d;
          });
          if (!cancelled) {
            setObjects((s) => ({ ...s, [body.id]: result }));
            setStatuses((s) => ({ ...s, [body.id]: "Loaded" }));
          }
        } catch (e) {
          if (!cancelled)
            setStatuses((s) => ({
              ...s,
              [body.id]: e instanceof Error ? e.message : "Unavailable",
            }));
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [range, attempt]);
  return { objects, statuses, retry: () => setAttempt((a) => a + 1) };
}
