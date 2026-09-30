"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DiscoveryResult, NeoStore } from "@/models/neo";
import type { ObjectId, TimeRange } from "@/models/trajectory";
import { loadDiscovery, loadNeoTrajectory } from "@/lib/neo/client";
import { reduceNeos, type NeoAction } from "@/lib/neo/store";
import { MAX_LOADED_NEOS, selectDefaultObjects } from "@/lib/neo/selection";
export function useNeoDiscovery(range: TimeRange) {
  const [store, setStore] = useState<NeoStore>({});
  const storeRef = useRef<NeoStore>({});
  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const tokens = useRef(new Map<ObjectId, number>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const update = useCallback((action: NeoAction) => {
    storeRef.current = reduceNeos(storeRef.current, action);
    if (mounted.current) setStore(storeRef.current);
  }, []);
  const add = useCallback(
    async (id: ObjectId) => {
      const entry = storeRef.current[id];
      if (!entry || entry.status === "loading") return;
      if (entry.status === "loaded") {
        update({ type: "visibility", id, visible: true });
        return;
      }
      const active = Object.values(storeRef.current).filter(
        (item) => item?.status === "loading" || item?.status === "loaded",
      ).length;
      if (active >= MAX_LOADED_NEOS) {
        update({
          type: "error",
          id,
          error: `Remove an object before loading more than ${MAX_LOADED_NEOS} trajectories.`,
        });
        return;
      }
      const token = (tokens.current.get(id) ?? 0) + 1;
      tokens.current.set(id, token);
      update({ type: "loading", id });
      try {
        const trajectory = await loadNeoTrajectory(
          id,
          entry.discoveryDate,
          range,
        );
        if (mounted.current && tokens.current.get(id) === token)
          update({ type: "loaded", id, trajectory });
      } catch (cause) {
        if (mounted.current && tokens.current.get(id) === token)
          update({
            type: "error",
            id,
            error:
              cause instanceof Error
                ? cause.message
                : "Unable to retrieve this trajectory.",
          });
      }
    },
    [range, update],
  );
  const discover = useCallback(
    async (date: string) => {
      const version = ++generation.current;
      setLoading(true);
      setError(null);
      try {
        const result = await loadDiscovery(date);
        if (!mounted.current || generation.current !== version) return;
        setDiscovery(result);
        update({ type: "discover", objects: result.objects, date });
        setLoading(false);
        for (const neo of selectDefaultObjects(result.objects)) {
          if (!mounted.current || generation.current !== version) break;
          // Leave explicit removals/hides alone on repeat discoveries in this session.
          if (tokens.current.has(neo.id)) continue;
          await add(neo.id);
        }
      } catch (cause) {
        if (mounted.current && generation.current === version) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to discover near-Earth objects.",
          );
          setLoading(false);
        }
      }
    },
    [add, update],
  );
  const remove = useCallback(
    (id: ObjectId) => {
      tokens.current.set(id, (tokens.current.get(id) ?? 0) + 1);
      update({ type: "remove", id });
    },
    [update],
  );
  const setVisible = useCallback(
    (id: ObjectId, visible: boolean) =>
      update({ type: "visibility", id, visible }),
    [update],
  );
  return useMemo(
    () => ({
      store,
      discovery,
      loading,
      error,
      discover,
      add,
      remove,
      setVisible,
    }),
    [store, discovery, loading, error, discover, add, remove, setVisible],
  );
}
export type NeoDiscovery = ReturnType<typeof useNeoDiscovery>;
