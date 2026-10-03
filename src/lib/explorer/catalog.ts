export const BODIES = [
  {
    id: "sun",
    name: "Sun",
    type: "star",
    horizonsId: "10",
    color: "#fff4d4",
    displayRadius: 0.039,
    stepMinutes: 1440,
  },
  {
    id: "mercury",
    name: "Mercury",
    type: "planet",
    horizonsId: "199",
    color: "#b9aaa0",
    displayRadius: 0.014,
    stepMinutes: 360,
  },
  {
    id: "venus",
    name: "Venus",
    type: "planet",
    horizonsId: "299",
    color: "#e2bf87",
    displayRadius: 0.018,
    stepMinutes: 360,
  },
  {
    id: "earth",
    name: "Earth",
    type: "planet",
    horizonsId: "399",
    color: "#79c9ff",
    displayRadius: 0.018,
    stepMinutes: 360,
  },
  {
    id: "moon",
    name: "Moon",
    type: "moon",
    horizonsId: "301",
    color: "#bfc7d0",
    displayRadius: 0.008,
    stepMinutes: 360,
  },
  {
    id: "mars",
    name: "Mars",
    type: "planet",
    horizonsId: "499",
    color: "#dd8a6c",
    displayRadius: 0.016,
    stepMinutes: 720,
  },
  {
    id: "jupiter",
    name: "Jupiter",
    type: "planet",
    horizonsId: "599",
    color: "#d6b89c",
    displayRadius: 0.038,
    stepMinutes: 1440,
  },
  {
    id: "saturn",
    name: "Saturn",
    type: "planet",
    horizonsId: "699",
    color: "#d5c68f",
    displayRadius: 0.032,
    stepMinutes: 1440,
  },
] as const;
export type BodyId = (typeof BODIES)[number]["id"];
export function bodyMetadata(id: string) {
  return BODIES.find((b) => b.id === id);
}
export interface Layers {
  spacecraft: boolean;
  spacecraftTrajectories: boolean;
  spacecraftLabels: boolean;
  planets: boolean;
  planetOrbits: boolean;
  moon: boolean;
  asteroids: boolean;
  asteroidTrajectories: boolean;
  labels: boolean;
  distanceLines: boolean;
}
export const DEFAULT_LAYERS: Layers = {
  spacecraft: true,
  spacecraftTrajectories: true,
  spacecraftLabels: true,
  planets: true,
  planetOrbits: true,
  moon: true,
  asteroids: true,
  asteroidTrajectories: true,
  labels: true,
  distanceLines: true,
};
export interface SolarCamera {
  mode: "inner" | "overview" | "focus" | "follow" | "context" | "interstellar";
  revision: number;
}
export function normalizeSearch(query: string) {
  return query.trim().toLowerCase().replace(/[()]/g, "").replace(/\s+/g, " ");
}
export function matchesSearch(query: string, ...terms: string[]) {
  const q = normalizeSearch(query);
  return terms.some((t) => normalizeSearch(t).includes(q));
}
