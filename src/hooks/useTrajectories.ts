"use client";
import { useCallback, useEffect, useState } from "react";
import type { TrajectoryDataset } from "@/models/trajectory";
// The browser only knows our API; the dataset stays in memory while scrubbing.
export function useTrajectories() {
  const [data, setData] = useState<TrajectoryDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const date = new URLSearchParams(window.location.search).get("date");
        const response = await fetch(
          `/api/trajectories${date ? `?date=${encodeURIComponent(date)}` : ""}`,
          {
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          const failure: unknown = await response.json();
          throw new Error(
            failure &&
              typeof failure === "object" &&
              "error" in failure &&
              typeof failure.error === "string"
              ? failure.error
              : "Unable to retrieve JPL Horizons data.",
          );
        }
        const dataset: TrajectoryDataset = await response.json();
        setData(dataset);
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to retrieve JPL Horizons data.",
          );
      }
    }
    void load();
    return () => controller.abort();
  }, [attempt]);
  return { data, error, retry };
}
