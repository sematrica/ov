import type { SpaceObjectTrajectory, TimeRange } from "./trajectory";
export interface SourceReference {
  name: string;
  url: string;
}
export interface Spacecraft {
  id: `spacecraft:${string}`;
  type: "spacecraft";
  name: string;
  horizonsId: string;
  designation?: string;
  aliases: string[];
  /** Lookup confirms a Horizons target, not coverage for an arbitrary date. */
  trajectoryAvailable: boolean;
  telemetryAvailable: boolean;
}
export interface MissionEvent {
  date: string;
  precision: "day";
  label: string;
  type: "launch" | "flyby" | "orbit-insertion" | "mission-end" | "milestone";
}
export interface MissionMetadata {
  mission: string;
  agency?: string;
  launchDate?: string;
  missionStatus?: string;
  description?: string;
  events: MissionEvent[];
  sources: SourceReference[];
  reviewedAt: string;
}
export interface SpacecraftRecord {
  spacecraft: Spacecraft;
  metadata?: MissionMetadata;
  metadataError?: string;
}
export interface SpacecraftTrajectoryResult {
  trajectory: SpaceObjectTrajectory;
  earth?: SpaceObjectTrajectory;
  earthError?: string;
  range: TimeRange;
  stepMinutes: number;
}
export interface SpacecraftEntry extends SpacecraftRecord {
  status: "discovered" | "loading" | "loaded" | "error";
  data?: SpacecraftTrajectoryResult;
  error?: string;
  visible: boolean;
  showTrajectory: boolean;
}
