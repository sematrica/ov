import { describe, expect, it, vi } from "vitest";
import { AsyncCache, SerialQueue } from "../src/lib/cache/asyncCache";
import { reduceNeos } from "../src/lib/neo/store";
import type { NearEarthObject } from "../src/models/neo";
import type { SpaceObjectTrajectory } from "../src/models/trajectory";
const neo: NearEarthObject = {
  id: "neo:1",
  nasaId: "1",
  name: "(2026 AB)",
  potentiallyHazardous: false,
  closeApproaches: [],
};
const trajectory: SpaceObjectTrajectory = {
  id: neo.id,
  name: neo.name,
  target: "2026 AB",
  points: [],
};
describe("bounded provider caches", () => {
  it("deduplicates simultaneous requests and reuses successes", async () => {
    const cache = new AsyncCache<string>(1000, 2);
    const load = vi.fn(async () => "result");
    const first = cache.get("one", load),
      second = cache.get("one", load);
    expect(first).toBe(second);
    expect(await first).toBe("result");
    expect(await cache.get("one", load)).toBe("result");
    expect(load).toHaveBeenCalledTimes(1);
  });
  it("does not retain failures and evicts oldest successes", async () => {
    const cache = new AsyncCache<string>(1000, 1);
    await expect(
      cache.get("a", async () => {
        throw new Error("offline");
      }),
    ).rejects.toThrow("offline");
    expect(await cache.get("a", async () => "recovered")).toBe("recovered");
    await cache.get("b", async () => "b");
    expect(await cache.get("a", async () => "fresh")).toBe("fresh");
  });
  it("expires cached values", async () => {
    vi.useFakeTimers();
    try {
      const cache = new AsyncCache<number>(10, 2);
      await cache.get("a", async () => 1);
      vi.advanceTimersByTime(11);
      expect(await cache.get("a", async () => 2)).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
  it("serializes provider traffic even after a failed request", async () => {
    const queue = new SerialQueue();
    const events: string[] = [];
    const a = queue.run(async () => {
      events.push("a start");
      await Promise.resolve();
      events.push("a end");
      throw new Error("failed");
    });
    const b = queue.run(async () => {
      events.push("b");
      return 2;
    });
    await expect(a).rejects.toThrow();
    expect(await b).toBe(2);
    expect(events).toEqual(["a start", "a end", "b"]);
  });
});
describe("multi-object state", () => {
  const discovered = () =>
    reduceNeos(
      {},
      {
        type: "discover",
        objects: [neo, { ...neo, id: "neo:2" }],
        date: "2026-09-27",
      },
    );
  it("distinguishes metadata, loading, trajectory, hidden, and removed states", () => {
    let store = discovered();
    expect(store[neo.id]?.trajectory).toBeUndefined();
    store = reduceNeos(store, { type: "loading", id: neo.id });
    expect(store[neo.id]?.status).toBe("loading");
    store = reduceNeos(store, { type: "loaded", id: neo.id, trajectory });
    store = reduceNeos(store, {
      type: "visibility",
      id: neo.id,
      visible: false,
    });
    expect(store[neo.id]?.trajectory).toBe(trajectory);
    expect(store[neo.id]?.visible).toBe(false);
    store = reduceNeos(store, { type: "remove", id: neo.id });
    expect(store[neo.id]?.status).toBe("discovered");
    expect(store[neo.id]?.trajectory).toBeUndefined();
  });
  it("isolates one asteroid's error from other loaded trajectories", () => {
    let store = reduceNeos(discovered(), {
      type: "loaded",
      id: neo.id,
      trajectory,
    });
    store = reduceNeos(store, {
      type: "error",
      id: "neo:2",
      error: "No Horizons match",
    });
    expect(store[neo.id]?.visible).toBe(true);
    expect(store["neo:2"]?.error).toBe("No Horizons match");
  });
  it("preserves loaded trajectories when discovery windows change", () => {
    const loaded = reduceNeos(discovered(), {
      type: "loaded",
      id: neo.id,
      trajectory,
    });
    const next = reduceNeos(loaded, {
      type: "discover",
      objects: [],
      date: "2026-09-28",
    });
    expect(next[neo.id]?.trajectory).toBe(trajectory);
    expect(next["neo:2"]).toBeUndefined();
  });
});
