/** Serializable UTC milliseconds; coordinates in AU, velocities in AU/day. */
export interface TrajectoryPoint {
  time: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}
export type ObjectId = "earth" | "apophis";
export interface SpaceObjectTrajectory {
  id: ObjectId;
  name: string;
  target: string;
  points: TrajectoryPoint[];
}
export interface TimeRange {
  start: number;
  end: number;
}
export interface TrajectoryDataset {
  range: TimeRange;
  fetchedAt: string;
  source: "NASA/JPL Horizons";
  frame: "Heliocentric · J2000 ecliptic";
  units: "AU";
  timeScale: "UTC";
  stepHours: number;
  objects: SpaceObjectTrajectory[];
}
export interface Position {
  x: number;
  y: number;
  z: number;
}
