import type { NearEarthObject, NeoStore } from "../../models/neo";
import type { ObjectId, SpaceObjectTrajectory } from "../../models/trajectory";
export type NeoAction =
  | { type: "discover"; objects: NearEarthObject[]; date: string }
  | { type: "loading"; id: ObjectId }
  | { type: "loaded"; id: ObjectId; trajectory: SpaceObjectTrajectory }
  | { type: "error"; id: ObjectId; error: string }
  | { type: "visibility"; id: ObjectId; visible: boolean }
  | { type: "remove"; id: ObjectId };
export function reduceNeos(store: NeoStore, action: NeoAction): NeoStore {
  if (action.type === "discover") {
    const next = { ...store };
    for (const metadata of action.objects) {
      next[metadata.id] = {
        status: "discovered",
        visible: false,
        ...next[metadata.id],
        metadata,
        discoveryDate: action.date,
      };
    }
    // Retain loaded/error entries across windows, but don't accumulate metadata forever.
    const currentIds = new Set(action.objects.map((object) => object.id));
    for (const key of Object.keys(next) as ObjectId[]) {
      if (!currentIds.has(key) && next[key]?.status === "discovered")
        delete next[key];
    }
    return next;
  }
  const entry = store[action.id];
  if (!entry) return store;
  switch (action.type) {
    case "loading":
      return {
        ...store,
        [action.id]: { ...entry, status: "loading", error: undefined },
      };
    case "loaded":
      return {
        ...store,
        [action.id]: {
          ...entry,
          status: "loaded",
          trajectory: action.trajectory,
          visible: true,
          error: undefined,
        },
      };
    case "error":
      return {
        ...store,
        [action.id]: {
          ...entry,
          status: "error",
          error: action.error,
          visible: false,
        },
      };
    case "visibility":
      return entry.status === "loaded"
        ? { ...store, [action.id]: { ...entry, visible: action.visible } }
        : store;
    case "remove":
      return {
        ...store,
        [action.id]: {
          ...entry,
          status: "discovered",
          trajectory: undefined,
          visible: false,
          error: undefined,
        },
      };
  }
}
