import type { ObjectId, SpaceObjectTrajectory } from "./trajectory";
export interface CloseApproach {
  time: number;
  timePrecision: "minute" | "day";
  relativeVelocityKmPerSecond?: number;
  missDistanceKm?: number;
  missDistanceLunar?: number;
  orbitingBody: string;
}
export interface NearEarthObject {
  id: ObjectId;
  nasaId: string;
  name: string;
  nasaJplUrl?: string;
  absoluteMagnitude?: number;
  estimatedDiameterMeters?: { min: number; max: number };
  potentiallyHazardous: boolean;
  closeApproaches: CloseApproach[];
}
export interface DiscoveryWindow {
  start: string;
  end: string;
}
export interface DiscoveryResult {
  date: string;
  window: DiscoveryWindow;
  objects: NearEarthObject[];
  demoKey: boolean;
  fetchedAt: string;
}
export interface NeoEntry {
  metadata: NearEarthObject;
  discoveryDate: string;
  status: "discovered" | "loading" | "loaded" | "error";
  trajectory?: SpaceObjectTrajectory;
  error?: string;
  visible: boolean;
}
export type NeoStore = Partial<Record<ObjectId, NeoEntry>>;
