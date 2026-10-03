"use client";
import { useRef, useState } from "react";
import { AsyncCache } from "@/lib/cache/asyncCache";
import { splitDateRange, type EventResult } from "@/lib/explorer/events";
const cache = new AsyncCache<EventResult>(3600000, 20);
export function useEvents() {
  const [result, setResult] = useState<EventResult>({
    events: [],
    failures: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const generation = useRef(0);
  async function load(start: string, end: string) {
    const token = ++generation.current;
    setLoading(true);
    setError(undefined);
    try {
      splitDateRange(start, end);
      let partial: EventResult | undefined;
      const data = await cache
        .get(`${start}:${end}`, async () => {
          const r = await fetch(
            `/api/events?${new URLSearchParams({ start, end })}`,
          );
          const d = await r.json();
          if (!r.ok) throw new Error(d.error ?? "Unable to load events.");
          if (d.failures.length) {
            partial = d;
            throw new Error("Partial results");
          }
          return d;
        })
        .catch((e) => {
          if (partial) return partial;
          throw e;
        });
      if (token === generation.current) setResult(data);
    } catch (e) {
      if (token === generation.current)
        setError(e instanceof Error ? e.message : "Unable to load events.");
    } finally {
      if (token === generation.current) setLoading(false);
    }
  }
  return {
    result,
    loading,
    error,
    load,
    cancel: () => {
      generation.current++;
      setLoading(false);
    },
  };
}
