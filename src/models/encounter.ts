import type { NearEarthObject, CloseApproach } from "./neo";
import type { SpaceObjectTrajectory, TimeRange } from "./trajectory";
export interface EncounterDataset {
  neo: NearEarthObject;
  approach: CloseApproach;
  range: TimeRange;
  stepMinutes: number;
  earth: SpaceObjectTrajectory;
  asteroid: SpaceObjectTrajectory;
  moon?: SpaceObjectTrajectory;
  moonError?: string;
}
